// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IClayRoyalty {
    function validatePrice(string memory projectId, uint256 priceETH, uint256 priceUSDC) external view returns (bool);
    function recordRoyalties(string memory projectId, uint256 price, uint8 paymentToken) external payable;
    function calculateTotalRoyalties(string memory projectId, uint256 priceETH, uint256 priceUSDC) external view returns (uint256 totalETH, uint256 totalUSDC);
}

/**
 * @title ClayLibrary
 * @notice Smart contract for managing Clay project library assets
 * @dev Handles project registration, ownership tracking, and revenue distribution
 * @dev Supports ETH and USDC payments with royalty distribution
 */
contract ClayLibrary is Ownable2Step, ReentrancyGuard {
    // USDC token address on Base Mainnet
    address public constant USDC_ADDRESS = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    IERC20 public immutable usdcToken;
    
    // Royalty tracker contract
    IClayRoyalty public royaltyContract;
    
    // Approved marketplaces (for transferAssetOwnership)
    mapping(address => bool) public approvedMarketplaces;
    
    enum PaymentToken { ETH, USDC }
    
    struct LibraryAsset {
        string projectId;           // Project ID on Irys
        string name;                // Asset name
        string description;         // Asset description
        uint256 priceETH;           // Price in ETH (wei)
        uint256 priceUSDC;          // Price in USDC (6 decimals)
        address currentOwner;       // Current owner (can change via marketplace)
        address originalCreator;    // Original creator (never changes)
        uint256 totalRevenueETH;    // Total revenue in ETH
        uint256 totalRevenueUSDC;   // Total revenue in USDC
        uint256 purchaseCount;      // Number of times purchased
        uint256 listedAt;           // Timestamp when listed
        bool isActive;              // Whether the asset is available
    }
    
    // Mapping from projectId to LibraryAsset
    mapping(string => LibraryAsset) public libraryAssets;
    
    // Mapping from projectId to array of purchasers
    mapping(string => address[]) public assetPurchasers;
    
    // Mapping from user address to their owned assets
    mapping(address => string[]) public userOwnedAssets;
    
    // Array of all registered asset IDs
    string[] public allAssetIds;
    
    // Platform fee percentage (e.g., 250 = 2.5%)
    uint256 public platformFeePercentage = 250; // 2.5%
    uint256 public constant FEE_DENOMINATOR = 10000;
    
    // Events
    event AssetRegistered(
        string indexed projectId,
        address indexed creator,
        string name,
        uint256 price
    );
    
    event AssetPurchased(
        string indexed projectId,
        address indexed buyer,
        address indexed currentOwner,
        uint256 price,
        uint256 platformFee
    );
    
    event OwnershipTransferred(
        string indexed projectId,
        address indexed previousOwner,
        address indexed newOwner
    );
    
    event AssetPriceUpdated(
        string indexed projectId,
        uint256 oldPrice,
        uint256 newPrice
    );
    
    event AssetDeactivated(
        string indexed projectId,
        address indexed owner
    );
    
    constructor(address _royaltyContract) Ownable(msg.sender) {
        usdcToken = IERC20(USDC_ADDRESS);
        royaltyContract = IClayRoyalty(_royaltyContract);
    }
    
    /**
     * @notice Update royalty contract address (only owner)
     */
    function setRoyaltyContract(address _royaltyContract) external onlyOwner {
        royaltyContract = IClayRoyalty(_royaltyContract);
    }
    
    /**
     * @notice Set approved marketplace for ownership transfers (only owner)
     * @param marketplace The marketplace address
     * @param approved Whether the marketplace is approved
     */
    function setApprovedMarketplace(address marketplace, bool approved) external onlyOwner {
        approvedMarketplaces[marketplace] = approved;
    }
    
    /**
     * @notice Register a new library asset
     * @param projectId The Irys project ID
     * @param name Asset name
     * @param description Asset description
     * @param priceETH Price in ETH (wei)
     * @param priceUSDC Price in USDC (6 decimals)
     */
    function registerAsset(
        string memory projectId,
        string memory name,
        string memory description,
        uint256 priceETH,
        uint256 priceUSDC
    ) external {
        require(bytes(projectId).length > 0, "Project ID cannot be empty");
        require(priceETH > 0 || priceUSDC > 0, "At least one price must be set");
        require(!libraryAssets[projectId].isActive, "Asset already registered");
        
        // Validate price meets minimum requirement (royalty floor)
        if (address(royaltyContract) != address(0)) {
            require(
                royaltyContract.validatePrice(projectId, priceETH, priceUSDC),
                "Price below minimum (must cover dependency royalties)"
            );
        }
        
        LibraryAsset memory newAsset = LibraryAsset({
            projectId: projectId,
            name: name,
            description: description,
            priceETH: priceETH,
            priceUSDC: priceUSDC,
            currentOwner: msg.sender,
            originalCreator: msg.sender,
            totalRevenueETH: 0,
            totalRevenueUSDC: 0,
            purchaseCount: 0,
            listedAt: block.timestamp,
            isActive: true
        });
        
        libraryAssets[projectId] = newAsset;
        userOwnedAssets[msg.sender].push(projectId);
        allAssetIds.push(projectId);
        
        emit AssetRegistered(projectId, msg.sender, name, priceETH);
    }
    
    /**
     * @notice Purchase a library asset with ETH
     * @param projectId The project ID to purchase
     */
    function purchaseAssetWithETH(string memory projectId) external payable nonReentrant {
        LibraryAsset storage asset = libraryAssets[projectId];
        require(asset.isActive, "Asset not available");
        require(asset.priceETH > 0, "ETH payment not accepted for this asset");
        
        // Calculate royalty amounts
        uint256 royaltyETH = 0;
        if (address(royaltyContract) != address(0)) {
            (royaltyETH, ) = royaltyContract.calculateTotalRoyalties(projectId, asset.priceETH, 0);
        }
        
        uint256 totalRequired = asset.priceETH + royaltyETH;
        require(msg.value >= totalRequired, "Insufficient payment (price + royalties)");
        
        // Record royalties (Pull Pattern)
        if (royaltyETH > 0) {
            royaltyContract.recordRoyalties{value: royaltyETH}(projectId, asset.priceETH, 0); // 0 = ETH
        }
        
        // Calculate platform fee from asset price (not including royalties)
        uint256 platformFee = (asset.priceETH * platformFeePercentage) / FEE_DENOMINATOR;
        uint256 ownerPayment = asset.priceETH - platformFee;
        
        // Transfer payment to current owner
        (bool success, ) = asset.currentOwner.call{value: ownerPayment}("");
        require(success, "Payment to owner failed");
        
        // Update asset statistics
        asset.totalRevenueETH += asset.priceETH;
        asset.purchaseCount += 1;
        
        // Record purchaser
        assetPurchasers[projectId].push(msg.sender);
        
        // Refund excess payment
        if (msg.value > totalRequired) {
            (bool refundSuccess, ) = msg.sender.call{value: msg.value - totalRequired}("");
            require(refundSuccess, "Refund failed");
        }
        
        emit AssetPurchased(projectId, msg.sender, asset.currentOwner, asset.priceETH, platformFee);
    }
    
    /**
     * @notice Purchase a library asset with USDC
     * @param projectId The project ID to purchase
     */
    function purchaseAssetWithUSDC(string memory projectId) external nonReentrant {
        LibraryAsset storage asset = libraryAssets[projectId];
        require(asset.isActive, "Asset not available");
        require(asset.priceUSDC > 0, "USDC payment not accepted for this asset");
        
        // Get royalty amounts
        uint256 royaltyUSDC = 0;
        if (address(royaltyContract) != address(0)) {
            (, royaltyUSDC) = royaltyContract.getTotalRoyalties(projectId);
        }
        
        // Calculate platform fee from asset price
        uint256 platformFee = (asset.priceUSDC * platformFeePercentage) / FEE_DENOMINATOR;
        uint256 ownerPayment = asset.priceUSDC - platformFee;
        
        // Transfer USDC from buyer to owner
        require(
            usdcToken.transferFrom(msg.sender, asset.currentOwner, ownerPayment),
            "Payment to owner failed"
        );
        
        // Transfer platform fee to contract
        require(
            usdcToken.transferFrom(msg.sender, address(this), platformFee),
            "Platform fee transfer failed"
        );
        
        // Distribute royalties
        if (royaltyUSDC > 0) {
            // First transfer royalties to this contract
            require(
                usdcToken.transferFrom(msg.sender, address(this), royaltyUSDC),
                "Royalty transfer to contract failed"
            );
            
            // Approve royalty contract to spend
            require(usdcToken.approve(address(royaltyContract), royaltyUSDC), "Approval failed");
            
            // Distribute via royalty contract
            royaltyContract.distributeRoyalties(projectId, 1); // 1 = USDC
        }
        
        // Update asset statistics
        asset.totalRevenueUSDC += asset.priceUSDC;
        asset.purchaseCount += 1;
        
        // Record purchaser
        assetPurchasers[projectId].push(msg.sender);
        
        emit AssetPurchased(projectId, msg.sender, asset.currentOwner, asset.priceUSDC, platformFee);
    }
    
    /**
     * @notice Transfer ownership of a library asset (for marketplace sales)
     * @param projectId The project ID
     * @param newOwner The new owner address
     */
    function transferAssetOwnership(
        string memory projectId,
        address newOwner
    ) external {
        LibraryAsset storage asset = libraryAssets[projectId];
        require(asset.isActive, "Asset not available");
        require(msg.sender == asset.currentOwner, "Only current owner can transfer");
        require(newOwner != address(0), "Invalid new owner");
        
        address previousOwner = asset.currentOwner;
        
        // Remove from previous owner's list
        _removeFromUserAssets(previousOwner, projectId);
        
        // Update owner
        asset.currentOwner = newOwner;
        
        // Add to new owner's list
        userOwnedAssets[newOwner].push(projectId);
        
        emit OwnershipTransferred(projectId, previousOwner, newOwner);
    }
    
    /**
     * @notice Update asset prices (only by current owner)
     * @param projectId The project ID
     * @param newPriceETH New price in ETH (wei)
     * @param newPriceUSDC New price in USDC (6 decimals)
     */
    function updateAssetPrice(
        string memory projectId,
        uint256 newPriceETH,
        uint256 newPriceUSDC
    ) external {
        LibraryAsset storage asset = libraryAssets[projectId];
        require(asset.isActive, "Asset not available");
        require(msg.sender == asset.currentOwner, "Only owner can update price");
        require(newPriceETH > 0 || newPriceUSDC > 0, "At least one price must be set");
        
        uint256 oldPriceETH = asset.priceETH;
        asset.priceETH = newPriceETH;
        asset.priceUSDC = newPriceUSDC;
        
        emit AssetPriceUpdated(projectId, oldPriceETH, newPriceETH);
    }
    
    /**
     * @notice Deactivate an asset (only by current owner)
     * @param projectId The project ID
     */
    function deactivateAsset(string memory projectId) external {
        LibraryAsset storage asset = libraryAssets[projectId];
        require(asset.isActive, "Asset already inactive");
        require(msg.sender == asset.currentOwner, "Only owner can deactivate");
        
        asset.isActive = false;
        
        emit AssetDeactivated(projectId, msg.sender);
    }
    
    /**
     * @notice Get asset details
     * @param projectId The project ID
     */
    function getAsset(string memory projectId) external view returns (LibraryAsset memory) {
        return libraryAssets[projectId];
    }
    
    /**
     * @notice Get all assets owned by a user
     * @param user The user address
     */
    function getUserAssets(address user) external view returns (string[] memory) {
        return userOwnedAssets[user];
    }
    
    /**
     * @notice Get purchasers of an asset
     * @param projectId The project ID
     */
    function getAssetPurchasers(string memory projectId) external view returns (address[] memory) {
        return assetPurchasers[projectId];
    }
    
    /**
     * @notice Get total number of registered assets
     */
    function getTotalAssets() external view returns (uint256) {
        return allAssetIds.length;
    }
    
    /**
     * @notice Get asset ID by index
     * @param index The index
     */
    function getAssetIdByIndex(uint256 index) external view returns (string memory) {
        require(index < allAssetIds.length, "Index out of bounds");
        return allAssetIds[index];
    }
    
    /**
     * @notice Update platform fee (only owner)
     * @param newFeePercentage New fee percentage (e.g., 250 = 2.5%)
     */
    function updatePlatformFee(uint256 newFeePercentage) external onlyOwner {
        require(newFeePercentage <= 1000, "Fee too high (max 10%)");
        platformFeePercentage = newFeePercentage;
    }
    
    /**
     * @notice Withdraw platform fees in ETH (only owner)
     */
    function withdrawPlatformFeesETH() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No ETH fees to withdraw");
        
        (bool success, ) = owner().call{value: balance}("");
        require(success, "Withdrawal failed");
    }
    
    /**
     * @notice Withdraw platform fees in USDC (only owner)
     */
    function withdrawPlatformFeesUSDC() external onlyOwner {
        uint256 balance = usdcToken.balanceOf(address(this));
        require(balance > 0, "No USDC fees to withdraw");
        
        require(usdcToken.transfer(owner(), balance), "Withdrawal failed");
    }
    
    /**
     * @dev Internal function to remove an asset from user's list
     */
    function _removeFromUserAssets(address user, string memory projectId) private {
        string[] storage assets = userOwnedAssets[user];
        for (uint256 i = 0; i < assets.length; i++) {
            if (keccak256(bytes(assets[i])) == keccak256(bytes(projectId))) {
                assets[i] = assets[assets.length - 1];
                assets.pop();
                break;
            }
        }
    }
}

