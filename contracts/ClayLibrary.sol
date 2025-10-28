// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IClayRoyalty {
    function recordRoyalties(string memory projectId, uint256 price, uint8 paymentToken) external payable;
    function calculateTotalRoyalties(string memory projectId) external view returns (uint256 totalETH, uint256 totalUSDC);
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
        uint256 royaltyPerImportETH;  // Royalty per import in ETH (wei)
        uint256 royaltyPerImportUSDC; // Royalty per import in USDC (6 decimals)
        address currentOwner;       // Current owner (can change via marketplace)
        address originalCreator;    // Original creator (never changes)
        uint256 listedAt;           // Timestamp when listed
        bool exists;                // Whether the asset exists (false = deleted)
        bool royaltyEnabled;        // Whether royalty is active (can be disabled by owner)
    }
    
    // Mapping from projectId to LibraryAsset
    mapping(string => LibraryAsset) public libraryAssets;
    
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
    
    event OwnershipTransferred(
        string indexed projectId,
        address indexed previousOwner,
        address indexed newOwner
    );
    
    event RoyaltyFeeUpdated(
        string indexed projectId,
        uint256 newRoyaltyETH,
        uint256 newRoyaltyUSDC
    );
    
    event RoyaltyDisabled(
        string indexed projectId,
        address indexed owner
    );
    
    event AssetDeleted(
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
     * @param royaltyPerImportETH Royalty per import in ETH (wei)
     * @param royaltyPerImportUSDC Royalty per import in USDC (6 decimals)
     */
    function registerAsset(
        string memory projectId,
        string memory name,
        string memory description,
        uint256 royaltyPerImportETH,
        uint256 royaltyPerImportUSDC
    ) external {
        require(bytes(projectId).length > 0, "Project ID cannot be empty");
        require(royaltyPerImportETH > 0 || royaltyPerImportUSDC > 0, "At least one royalty must be set");
        require(!libraryAssets[projectId].exists, "Asset already registered");
        
        LibraryAsset memory newAsset = LibraryAsset({
            projectId: projectId,
            name: name,
            description: description,
            royaltyPerImportETH: royaltyPerImportETH,
            royaltyPerImportUSDC: royaltyPerImportUSDC,
            currentOwner: msg.sender,
            originalCreator: msg.sender,
            listedAt: block.timestamp,
            exists: true,
            royaltyEnabled: true
        });
        
        libraryAssets[projectId] = newAsset;
        userOwnedAssets[msg.sender].push(projectId);
        allAssetIds.push(projectId);
        
        emit AssetRegistered(projectId, msg.sender, name, royaltyPerImportETH);
    }
    
    /**
     * @notice Update royalty fees (only by current owner)
     * @param projectId The project ID
     * @param newRoyaltyETH New royalty per import in ETH
     * @param newRoyaltyUSDC New royalty per import in USDC
     */
    function updateRoyaltyFee(
        string memory projectId,
        uint256 newRoyaltyETH,
        uint256 newRoyaltyUSDC
    ) external {
        LibraryAsset storage asset = libraryAssets[projectId];
        require(asset.exists, "Asset not found");
        require(msg.sender == asset.currentOwner, "Only owner can update royalty");
        require(newRoyaltyETH > 0 || newRoyaltyUSDC > 0, "At least one royalty must be set");
        
        asset.royaltyPerImportETH = newRoyaltyETH;
        asset.royaltyPerImportUSDC = newRoyaltyUSDC;
        
        emit RoyaltyFeeUpdated(projectId, newRoyaltyETH, newRoyaltyUSDC);
    }
    
    /**
     * @notice Get royalty fee for a library asset
     * @param projectId The project ID
     */
    function getRoyaltyFee(string memory projectId) external view returns (uint256 royaltyETH, uint256 royaltyUSDC) {
        LibraryAsset storage asset = libraryAssets[projectId];
        
        // Return 0 if royalty is disabled
        if (!asset.royaltyEnabled) {
            return (0, 0);
        }
        
        return (asset.royaltyPerImportETH, asset.royaltyPerImportUSDC);
    }
    
    // Purchase functions removed - all transactions through Marketplace only
    
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
        require(asset.exists, "Asset not found");
        require(
            msg.sender == asset.currentOwner || approvedMarketplaces[msg.sender],
            "Not authorized to transfer"
        );
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
    
    // Asset price update removed - royalty fees managed by updateRoyaltyFee instead
    
    /**
     * @notice Disable royalty for an asset (only by current owner)
     * @dev Asset remains tradable in marketplace, but no royalties will be charged on new uses
     * @param projectId The project ID
     */
    function disableRoyalty(string memory projectId) external {
        LibraryAsset storage asset = libraryAssets[projectId];
        require(asset.exists, "Asset not found");
        require(asset.royaltyEnabled, "Royalty already disabled");
        require(msg.sender == asset.currentOwner, "Only owner can disable royalty");
        
        asset.royaltyEnabled = false;
        
        emit RoyaltyDisabled(projectId, msg.sender);
    }
    
    /**
     * @notice Enable royalty for an asset (only by current owner)
     * @param projectId The project ID
     */
    function enableRoyalty(string memory projectId) external {
        LibraryAsset storage asset = libraryAssets[projectId];
        require(asset.exists, "Asset not found");
        require(!asset.royaltyEnabled, "Royalty already enabled");
        require(msg.sender == asset.currentOwner, "Only owner can enable royalty");
        
        asset.royaltyEnabled = true;
        
        emit RoyaltyFeeUpdated(projectId, asset.royaltyPerImportETH, asset.royaltyPerImportUSDC);
    }
    
    /**
     * @notice Delete an asset permanently (only by current owner)
     * @dev This makes the asset untradable and removes it from existence
     * @param projectId The project ID
     */
    function deleteAsset(string memory projectId) external {
        LibraryAsset storage asset = libraryAssets[projectId];
        require(asset.exists, "Asset not found");
        require(msg.sender == asset.currentOwner, "Only owner can delete");
        
        asset.exists = false;
        asset.royaltyEnabled = false;
        
        emit AssetDeleted(projectId, msg.sender);
    }
    
    /**
     * @notice Get asset details
     * @param projectId The project ID
     */
    function getAsset(string memory projectId) external view returns (LibraryAsset memory) {
        return libraryAssets[projectId];
    }
    
    /**
     * @notice Get current owner of an asset
     * @param projectId The project ID
     * @return currentOwner address, or address(0) if asset doesn't exist
     */
    function getCurrentOwner(string memory projectId) external view returns (address) {
        LibraryAsset storage asset = libraryAssets[projectId];
        
        // Return zero address only if asset doesn't exist (deleted)
        if (!asset.exists) {
            return address(0);
        }
        
        return asset.currentOwner;
    }
    
    /**
     * @notice Get all assets owned by a user
     * @param user The user address
     */
    function getUserAssets(address user) external view returns (string[] memory) {
        return userOwnedAssets[user];
    }
    
    // Purchasers tracking removed - Marketplace handles all transactions
    
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
    
    // Platform fees removed - Marketplace handles all transactions and fees
    
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

