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
        uint256,
        uint256,
        uint256,
        bool
    );
}

/**
 * @title ClayMarketplace
 * @notice NFT-style marketplace for buying/selling Clay library assets
 * @dev Supports fixed-price listings and offer system
 */
contract ClayMarketplace is Ownable, ReentrancyGuard {
    IClayLibrary public libraryContract;
    
    // USDC token address on Base Sepolia testnet
    address public constant USDC_ADDRESS = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
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
    
    constructor(address _libraryContract) Ownable(msg.sender) {
        libraryContract = IClayLibrary(_libraryContract);
        usdcToken = IERC20(USDC_ADDRESS);
    }
    
    /**
     * @notice List an asset for sale at a fixed price
     * @param projectId The project ID
     * @param price Sale price
     * @param paymentToken Payment token (0: ETH, 1: USDC)
     */
    function listAsset(string memory projectId, uint256 price, PaymentToken paymentToken) external {
        require(price > 0, "Price must be greater than 0");
        require(!listings[projectId].isActive, "Asset already listed");
        
        // Verify caller owns the asset in library
        (,,,,,address currentOwner,,,,, uint256 listedAt, bool isActive) = libraryContract.getAsset(projectId);
        require(isActive, "Asset not found in library");
        require(currentOwner == msg.sender, "Only owner can list asset");
        
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
     */
    function buyAsset(string memory projectId) external payable nonReentrant {
        Listing storage listing = listings[projectId];
        require(listing.isActive, "Listing not active");
        require(msg.sender != listing.seller, "Cannot buy your own asset");
        
        // Calculate fees
        uint256 platformFee = (listing.price * platformFeePercentage) / FEE_DENOMINATOR;
        uint256 sellerPayment = listing.price - platformFee;
        
        if (listing.paymentToken == PaymentToken.ETH) {
            require(msg.value >= listing.price, "Insufficient ETH payment");
            
            // Transfer ETH to seller
            (bool success, ) = listing.seller.call{value: sellerPayment}("");
            require(success, "Payment to seller failed");
            
            // Refund excess payment
            if (msg.value > listing.price) {
                (bool refundSuccess, ) = msg.sender.call{value: msg.value - listing.price}("");
                require(refundSuccess, "Refund failed");
            }
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
        
        // Transfer ownership in library contract
        libraryContract.transferAssetOwnership(projectId, msg.sender);
        
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
     */
    function cancelListing(string memory projectId) external {
        Listing storage listing = listings[projectId];
        require(listing.isActive, "Listing not active");
        require(msg.sender == listing.seller, "Only seller can cancel");
        
        listing.isActive = false;
        _removeFromActiveListings(projectId);
        
        emit ListingCancelled(projectId, msg.sender);
    }
    
    /**
     * @notice Make an offer for an asset
     * @param projectId The project ID
     * @param duration Offer validity duration in seconds
     */
    function makeOffer(
        string memory projectId,
        uint256 duration
    ) external payable {
        require(msg.value > 0, "Offer must have value");
        require(duration >= 1 hours && duration <= 30 days, "Invalid duration");
        
        // Verify asset exists in library
        (,,,, address currentOwner,,,, uint256 listedAt, bool isActive) = libraryContract.getAsset(projectId);
        require(isActive, "Asset not found in library");
        require(currentOwner != msg.sender, "Cannot offer on your own asset");
        
        uint256 offerId = nextOfferId++;
        uint256 expiresAt = block.timestamp + duration;
        
        Offer memory newOffer = Offer({
            projectId: projectId,
            buyer: msg.sender,
            offerPrice: msg.value,
            offeredAt: block.timestamp,
            expiresAt: expiresAt,
            isActive: true
        });
        
        offers[offerId] = newOffer;
        projectOffers[projectId].push(offerId);
        
        emit OfferCreated(offerId, projectId, msg.sender, msg.value, expiresAt);
    }
    
    /**
     * @notice Accept an offer
     * @param offerId The offer ID
     */
    function acceptOffer(uint256 offerId) external nonReentrant {
        Offer storage offer = offers[offerId];
        require(offer.isActive, "Offer not active");
        require(block.timestamp < offer.expiresAt, "Offer expired");
        
        // Verify caller owns the asset
        (,,,, address currentOwner,,,, uint256 listedAt, bool isActive) = libraryContract.getAsset(offer.projectId);
        require(isActive, "Asset not found in library");
        require(currentOwner == msg.sender, "Only owner can accept offer");
        
        // Calculate fees
        uint256 platformFee = (offer.offerPrice * platformFeePercentage) / FEE_DENOMINATOR;
        uint256 sellerPayment = offer.offerPrice - platformFee;
        
        // Transfer payment to seller
        (bool success, ) = msg.sender.call{value: sellerPayment}("");
        require(success, "Payment to seller failed");
        
        // Transfer ownership in library contract
        libraryContract.transferAssetOwnership(offer.projectId, offer.buyer);
        
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
        
        // Refund the offer amount
        uint256 refundAmount = offer.offerPrice;
        offer.isActive = false;
        
        (bool success, ) = msg.sender.call{value: refundAmount}("");
        require(success, "Refund failed");
        
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
                // Refund the offer (Note: This could be gas-intensive for many offers)
                (bool success, ) = offer.buyer.call{value: offer.offerPrice}("");
                // If refund fails, buyer can claim manually later
                if (success) {
                    emit OfferCancelled(offerIds[i], projectId, offer.buyer);
                }
            }
        }
    }
}

