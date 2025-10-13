// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title ClayLibrary
 * @notice Smart contract for managing Clay project library assets
 * @dev Handles project registration, ownership tracking, and revenue distribution
 * @dev Supports ETH and USDC payments
 */
contract ClayLibrary is Ownable, ReentrancyGuard {
    // USDC token address on Base Sepolia testnet
    address public constant USDC_ADDRESS = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    IERC20 public immutable usdcToken;
    
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
    
    constructor() Ownable(msg.sender) {
        usdcToken = IERC20(USDC_ADDRESS);
    }
    
    /**
     * @notice Register a new library asset
     * @param projectId The Irys project ID
     * @param name Asset name
     * @param description Asset description
     * @param price Price in wei
     */
    function registerAsset(
        string memory projectId,
        string memory name,
        string memory description,
        uint256 price
    ) external {
        require(bytes(projectId).length > 0, "Project ID cannot be empty");
        require(price > 0, "Price must be greater than 0");
        require(!libraryAssets[projectId].isActive, "Asset already registered");
        
        LibraryAsset memory newAsset = LibraryAsset({
            projectId: projectId,
            name: name,
            description: description,
            price: price,
            currentOwner: msg.sender,
            originalCreator: msg.sender,
            totalRevenue: 0,
            purchaseCount: 0,
            listedAt: block.timestamp,
            isActive: true
        });
        
        libraryAssets[projectId] = newAsset;
        userOwnedAssets[msg.sender].push(projectId);
        allAssetIds.push(projectId);
        
        emit AssetRegistered(projectId, msg.sender, name, price);
    }
    
    /**
     * @notice Purchase a library asset
     * @param projectId The project ID to purchase
     */
    function purchaseAsset(string memory projectId) external payable nonReentrant {
        LibraryAsset storage asset = libraryAssets[projectId];
        require(asset.isActive, "Asset not available");
        require(msg.value >= asset.price, "Insufficient payment");
        
        // Calculate platform fee
        uint256 platformFee = (asset.price * platformFeePercentage) / FEE_DENOMINATOR;
        uint256 ownerPayment = asset.price - platformFee;
        
        // Transfer payment to current owner
        (bool success, ) = asset.currentOwner.call{value: ownerPayment}("");
        require(success, "Payment to owner failed");
        
        // Platform fee stays in contract for withdrawal by owner
        
        // Update asset statistics
        asset.totalRevenue += asset.price;
        asset.purchaseCount += 1;
        
        // Record purchaser
        assetPurchasers[projectId].push(msg.sender);
        
        // Refund excess payment
        if (msg.value > asset.price) {
            (bool refundSuccess, ) = msg.sender.call{value: msg.value - asset.price}("");
            require(refundSuccess, "Refund failed");
        }
        
        emit AssetPurchased(projectId, msg.sender, asset.currentOwner, asset.price, platformFee);
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
     * @notice Update asset price (only by current owner)
     * @param projectId The project ID
     * @param newPrice New price in wei
     */
    function updateAssetPrice(
        string memory projectId,
        uint256 newPrice
    ) external {
        LibraryAsset storage asset = libraryAssets[projectId];
        require(asset.isActive, "Asset not available");
        require(msg.sender == asset.currentOwner, "Only owner can update price");
        require(newPrice > 0, "Price must be greater than 0");
        
        uint256 oldPrice = asset.price;
        asset.price = newPrice;
        
        emit AssetPriceUpdated(projectId, oldPrice, newPrice);
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
     * @notice Withdraw platform fees (only owner)
     */
    function withdrawPlatformFees() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No fees to withdraw");
        
        (bool success, ) = owner().call{value: balance}("");
        require(success, "Withdrawal failed");
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

