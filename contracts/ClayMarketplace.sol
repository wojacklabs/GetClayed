// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IClayLibrary {
    function transferAssetOwnership(string memory projectId, address newOwner) external;
    function getAsset(string memory projectId) external view returns (
        string memory,
        string memory,
        string memory,
        uint256,
        uint256,
        address,
        address,
        uint256,
        bool,
        bool
    );
}

interface IClayRoyalty {
    function calculateTotalRoyalties(string memory projectId) external view returns (uint256 totalETH, uint256 totalUSDC);
    function totalRoyaltiesPaidETH(string memory projectId) external view returns (uint256);
    function totalRoyaltiesPaidUSDC(string memory projectId) external view returns (uint256);
}

/**
 * @title ClayMarketplace
 * @notice NFT-style marketplace for buying/selling Clay library assets
 * @dev Supports fixed-price listings and offer system
 */
contract ClayMarketplace is Ownable, ReentrancyGuard {
    IClayLibrary public libraryContract;
    IClayRoyalty public royaltyContract;
    
    // USDC token address on Base Mainnet
    address public constant USDC_ADDRESS = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    IERC20 public immutable usdcToken;
    
    enum PaymentToken { ETH, USDC }
    
    struct Listing {
        string projectId;
        address seller;
        uint256 price;
        PaymentToken paymentToken;
        uint256 listedAt;
        bool isActive;
    }
    
    struct Offer {
        string projectId;
        address buyer;
        uint256 offerPrice;
        PaymentToken paymentToken;
        uint256 offeredAt;
        uint256 expiresAt;
        bool isActive;
    }
    
    // Mapping from projectId to Listing
    mapping(string => Listing) public listings;
    
    // Mapping from offerId to Offer
    mapping(uint256 => Offer) public offers;
    
    // Mapping from projectId to array of offer IDs
    mapping(string => uint256[]) public projectOffers;
    
    // Counter for offer IDs
    uint256 public nextOfferId = 1;
    
    // Array of all active listing IDs
    string[] public activeListings;
    
    // Direct ownership for non-library assets (no royalty)
    // Allows marketplace listing without library registration
    mapping(string => address) public directOwners;
    
    // Track if asset is library-based or direct
    mapping(string => bool) public isLibraryBased;
    
    // Platform fee percentage (e.g., 250 = 2.5%)
    uint256 public platformFeePercentage = 250;
    uint256 public constant FEE_DENOMINATOR = 10000;
    
    // Events
    event AssetListed(
        string indexed projectId,
        address indexed seller,
        uint256 price,
        uint256 timestamp
    );
    
    event AssetSold(
        string indexed projectId,
        address indexed seller,
        address indexed buyer,
        uint256 price,
        uint256 platformFee
    );
    
    event ListingCancelled(
        string indexed projectId,
        address indexed seller
    );
    
    event OfferCreated(
        uint256 indexed offerId,
        string indexed projectId,
        address indexed buyer,
        uint256 offerPrice,
        uint256 expiresAt
    );
    
    event OfferAccepted(
        uint256 indexed offerId,
        string indexed projectId,
        address indexed seller,
        address buyer,
        uint256 price
    );
    
    event OfferCancelled(
        uint256 indexed offerId,
        string indexed projectId,
        address indexed buyer
    );
    
    event OfferRefundFailed(
        uint256 indexed offerId,
        string indexed projectId,
        address indexed buyer,
        uint256 refundAmount
    );
    
    event ListingPriceUpdated(
        string indexed projectId,
        uint256 oldPrice,
        uint256 newPrice
    );
    
    constructor(address _libraryContract, address _royaltyContract) Ownable(msg.sender) {
        libraryContract = IClayLibrary(_libraryContract);
        royaltyContract = IClayRoyalty(_royaltyContract);
        usdcToken = IERC20(USDC_ADDRESS);
    }
    
    /**
     * @notice Update royalty contract address (only owner)
     */
    function setRoyaltyContract(address _royaltyContract) external onlyOwner {
        royaltyContract = IClayRoyalty(_royaltyContract);
    }
    
    /**
     * @notice List an asset for sale at a fixed price
     * @param projectId The project ID
     * @param price Sale price
     * @param paymentToken Payment token (0: ETH, 1: USDC)
     * @dev Supports two paths:
     *      1. Library-based: Asset registered in ClayLibrary (with royalties)
     *      2. Direct: Asset not in library (no royalties, direct ownership)
     */
    function listAsset(string memory projectId, uint256 price, PaymentToken paymentToken) external {
        require(price > 0, "Price must be greater than 0");
        require(!listings[projectId].isActive, "Asset already listed");
        
        address assetOwner;
        bool libraryAsset = false;
        
        // 1. Try to get asset from library
        try libraryContract.getAsset(projectId) returns (
            string memory,
            string memory,
            string memory,
            uint256,
            uint256,
            address currentOwner,
            address,
            uint256,
            bool exists,
            bool
        ) {
            if (exists) {
                libraryAsset = true;
                assetOwner = currentOwner;
                
                // For library assets, validate price against PAID royalties
                if (address(royaltyContract) != address(0)) {
                    uint256 paidETH = royaltyContract.totalRoyaltiesPaidETH(projectId);
                    uint256 paidUSDC = royaltyContract.totalRoyaltiesPaidUSDC(projectId);
                    
                    if (paymentToken == PaymentToken.ETH) {
                        require(price > paidETH, "Price must be higher than royalties paid");
                    } else {
                        require(price > paidUSDC, "Price must be higher than royalties paid");
                    }
                }
            }
        } catch {
            // Library call failed, asset not in library
        }
        
        // 2. If not in library, use direct ownership
        if (!libraryAsset) {
            if (directOwners[projectId] == address(0)) {
                // First listing - caller becomes owner
                directOwners[projectId] = msg.sender;
            }
            assetOwner = directOwners[projectId];
        }
        
        require(assetOwner == msg.sender, "Only owner can list asset");
        
        // Store asset type
        isLibraryBased[projectId] = libraryAsset;
        
        Listing memory newListing = Listing({
            projectId: projectId,
            seller: msg.sender,
            price: price,
            paymentToken: paymentToken,
            listedAt: block.timestamp,
            isActive: true
        });
        
        listings[projectId] = newListing;
        activeListings.push(projectId);
        
        emit AssetListed(projectId, msg.sender, price, block.timestamp);
    }
    
    /**
     * @notice Buy an asset at the listed price
     * @param projectId The project ID
     * @dev Handles both library-based and direct ownership transfers
     */
    function buyAsset(string memory projectId) external payable nonReentrant {
        Listing storage listing = listings[projectId];
        require(listing.isActive, "Listing not active");
        require(msg.sender != listing.seller, "Cannot buy your own asset");
        
        // Calculate fees
        uint256 platformFee = (listing.price * platformFeePercentage) / FEE_DENOMINATOR;
        uint256 sellerPayment = listing.price - platformFee;
        
        if (listing.paymentToken == PaymentToken.ETH) {
            // FIX: Require exact amount to prevent refund failures
            require(msg.value == listing.price, "Exact ETH amount required");
            
            // Transfer ETH to seller
            (bool success, ) = listing.seller.call{value: sellerPayment}("");
            require(success, "Payment to seller failed");
        } else {
            require(msg.value == 0, "Do not send ETH for USDC purchase");
            
            // Transfer USDC to seller
            require(
                usdcToken.transferFrom(msg.sender, listing.seller, sellerPayment),
                "Payment to seller failed"
            );
            
            // Transfer platform fee
            require(
                usdcToken.transferFrom(msg.sender, address(this), platformFee),
                "Platform fee transfer failed"
            );
        }
        
        // Transfer ownership based on asset type
        if (isLibraryBased[projectId]) {
            // Library-based: transfer via library contract
            libraryContract.transferAssetOwnership(projectId, msg.sender);
        } else {
            // Direct: update direct ownership mapping
            directOwners[projectId] = msg.sender;
        }
        
        // Deactivate listing
        listing.isActive = false;
        _removeFromActiveListings(projectId);
        
        // Cancel all active offers for this asset
        _cancelAllOffers(projectId);
        
        emit AssetSold(projectId, listing.seller, msg.sender, listing.price, platformFee);
    }
    
    /**
     * @notice Cancel a listing
     * @param projectId The project ID
     * @dev CRITICAL FIX: Also cancels all active offers and refunds buyers
     */
    function cancelListing(string memory projectId) external {
        Listing storage listing = listings[projectId];
        require(listing.isActive, "Listing not active");
        require(msg.sender == listing.seller, "Only seller can cancel");
        
        listing.isActive = false;
        _removeFromActiveListings(projectId);
        
        // CRITICAL FIX: Cancel all active offers for this asset and refund buyers
        // This prevents buyers' funds from being locked when seller cancels listing
        _cancelAllOffers(projectId);
        
        emit ListingCancelled(projectId, msg.sender);
    }
    
    /**
     * @notice Update listing price
     * @param projectId The project ID
     * @param newPrice New price
     */
    function updateListingPrice(string memory projectId, uint256 newPrice) external {
        Listing storage listing = listings[projectId];
        require(listing.isActive, "Listing not active");
        require(msg.sender == listing.seller, "Only seller can update");
        require(newPrice > 0, "Price must be greater than 0");
        
        uint256 oldPrice = listing.price;
        listing.price = newPrice;
        
        emit ListingPriceUpdated(projectId, oldPrice, newPrice);
    }
    
    /**
     * @notice Make an offer for an asset
     * @param projectId The project ID
     * @param offerPrice Offer price
     * @param paymentToken Payment token (0: ETH, 1: USDC)
     * @param duration Offer validity duration in seconds
     * @dev Supports both library-based and direct ownership assets
     */
    function makeOffer(
        string memory projectId,
        uint256 offerPrice,
        PaymentToken paymentToken,
        uint256 duration
    ) external payable {
        require(offerPrice > 0, "Offer must have value");
        require(duration >= 1 hours && duration <= 30 days, "Invalid duration");
        
        // Get current asset owner (library or direct)
        address currentOwner = _getAssetOwner(projectId);
        require(currentOwner != address(0), "Asset has no owner");
        require(currentOwner != msg.sender, "Cannot offer on your own asset");
        
        // Handle payment based on token type
        if (paymentToken == PaymentToken.ETH) {
            require(msg.value == offerPrice, "ETH amount mismatch");
        } else {
            require(msg.value == 0, "Do not send ETH for USDC offer");
            // Transfer USDC to contract as escrow
            require(
                usdcToken.transferFrom(msg.sender, address(this), offerPrice),
                "USDC transfer failed"
            );
        }
        
        uint256 offerId = nextOfferId++;
        uint256 expiresAt = block.timestamp + duration;
        
        Offer memory newOffer = Offer({
            projectId: projectId,
            buyer: msg.sender,
            offerPrice: offerPrice,
            paymentToken: paymentToken,
            offeredAt: block.timestamp,
            expiresAt: expiresAt,
            isActive: true
        });
        
        offers[offerId] = newOffer;
        projectOffers[projectId].push(offerId);
        
        emit OfferCreated(offerId, projectId, msg.sender, offerPrice, expiresAt);
    }
    
    /**
     * @notice Accept an offer
     * @param offerId The offer ID
     * @dev Handles both library-based and direct ownership transfers
     */
    function acceptOffer(uint256 offerId) external nonReentrant {
        Offer storage offer = offers[offerId];
        require(offer.isActive, "Offer not active");
        require(block.timestamp < offer.expiresAt, "Offer expired");
        
        // Verify caller owns the asset (library or direct)
        address currentOwner = _getAssetOwner(offer.projectId);
        require(currentOwner != address(0), "Asset has no owner");
        require(currentOwner == msg.sender, "Only owner can accept offer");
        
        // Calculate fees
        uint256 platformFee = (offer.offerPrice * platformFeePercentage) / FEE_DENOMINATOR;
        uint256 sellerPayment = offer.offerPrice - platformFee;
        
        // Transfer payment to seller based on token type
        if (offer.paymentToken == PaymentToken.ETH) {
            (bool success, ) = msg.sender.call{value: sellerPayment}("");
            require(success, "Payment to seller failed");
        } else {
            require(
                usdcToken.transfer(msg.sender, sellerPayment),
                "Payment to seller failed"
            );
        }
        
        // Transfer ownership based on asset type
        if (isLibraryBased[offer.projectId]) {
            // Library-based: transfer via library contract
            libraryContract.transferAssetOwnership(offer.projectId, offer.buyer);
        } else {
            // Direct: update direct ownership mapping
            directOwners[offer.projectId] = offer.buyer;
        }
        
        // Deactivate offer
        offer.isActive = false;
        
        // Cancel listing if exists
        if (listings[offer.projectId].isActive) {
            listings[offer.projectId].isActive = false;
            _removeFromActiveListings(offer.projectId);
        }
        
        // Cancel all other offers for this asset
        _cancelAllOffers(offer.projectId);
        
        emit OfferAccepted(offerId, offer.projectId, msg.sender, offer.buyer, offer.offerPrice);
        emit AssetSold(offer.projectId, msg.sender, offer.buyer, offer.offerPrice, platformFee);
    }
    
    /**
     * @notice Cancel an offer and get refund
     * @param offerId The offer ID
     */
    function cancelOffer(uint256 offerId) external nonReentrant {
        Offer storage offer = offers[offerId];
        require(offer.isActive, "Offer not active");
        require(msg.sender == offer.buyer, "Only buyer can cancel offer");
        
        uint256 refundAmount = offer.offerPrice;
        offer.isActive = false;
        
        // Refund based on payment token
        if (offer.paymentToken == PaymentToken.ETH) {
            (bool success, ) = msg.sender.call{value: refundAmount}("");
            require(success, "Refund failed");
        } else {
            require(
                usdcToken.transfer(msg.sender, refundAmount),
                "Refund failed"
            );
        }
        
        emit OfferCancelled(offerId, offer.projectId, msg.sender);
    }
    
    /**
     * @notice Get all offers for a project
     * @param projectId The project ID
     */
    function getProjectOffers(string memory projectId) external view returns (uint256[] memory) {
        return projectOffers[projectId];
    }
    
    /**
     * @notice Get active listings count
     */
    function getActiveListingsCount() external view returns (uint256) {
        return activeListings.length;
    }
    
    /**
     * @notice Update platform fee (only owner)
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
     * @dev Internal function to remove from active listings
     */
    function _removeFromActiveListings(string memory projectId) private {
        for (uint256 i = 0; i < activeListings.length; i++) {
            if (keccak256(bytes(activeListings[i])) == keccak256(bytes(projectId))) {
                activeListings[i] = activeListings[activeListings.length - 1];
                activeListings.pop();
                break;
            }
        }
    }
    
    /**
     * @dev Internal function to cancel all offers for a project
     */
    function _cancelAllOffers(string memory projectId) private {
        uint256[] storage offerIds = projectOffers[projectId];
        for (uint256 i = 0; i < offerIds.length; i++) {
            Offer storage offer = offers[offerIds[i]];
            if (offer.isActive) {
                offer.isActive = false;
                
                // Refund based on payment token
                bool success = false;
                if (offer.paymentToken == PaymentToken.ETH) {
                    (success, ) = offer.buyer.call{value: offer.offerPrice}("");
                } else {
                    success = usdcToken.transfer(offer.buyer, offer.offerPrice);
                }
                
                // FIX: Emit event even if refund fails, so user knows to claim manually
                if (success) {
                    emit OfferCancelled(offerIds[i], projectId, offer.buyer);
                } else {
                    emit OfferRefundFailed(offerIds[i], projectId, offer.buyer, offer.offerPrice);
                }
            }
        }
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
     * @notice Get asset owner (library or direct)
     * @param projectId The project ID
     * @return owner The current owner address
     */
    function getAssetOwner(string memory projectId) external view returns (address) {
        return _getAssetOwner(projectId);
    }
    
    /**
     * @notice Check if asset is library-based
     * @param projectId The project ID
     * @return True if library-based, false if direct ownership
     */
    function isAssetLibraryBased(string memory projectId) external view returns (bool) {
        return isLibraryBased[projectId];
    }
    
    /**
     * @dev Internal function to get asset owner (library or direct)
     */
    function _getAssetOwner(string memory projectId) internal view returns (address) {
        // First check if it's already marked as library-based
        if (isLibraryBased[projectId]) {
            try libraryContract.getAsset(projectId) returns (
                string memory,
                string memory,
                string memory,
                uint256,
                uint256,
                address currentOwner,
                address,
                uint256,
                bool exists,
                bool
            ) {
                if (exists) {
                    return currentOwner;
                }
            } catch {
                // Library call failed
            }
        }
        
        // Check direct ownership
        if (directOwners[projectId] != address(0)) {
            return directOwners[projectId];
        }
        
        // Try library as fallback (for assets not yet listed)
        try libraryContract.getAsset(projectId) returns (
            string memory,
            string memory,
            string memory,
            uint256,
            uint256,
            address currentOwner,
            address,
            uint256,
            bool exists,
            bool
        ) {
            if (exists) {
                return currentOwner;
            }
        } catch {
            // Library call failed
        }
        
        return address(0);
    }
}

