// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title ClayRoyalty
 * @notice Tracks library dependencies and enforces minimum pricing with royalty distribution
 * @dev Ensures creators can't undercut by enforcing price floor based on used libraries
 */
contract ClayRoyalty is Ownable, ReentrancyGuard {
    // USDC token
    address public constant USDC_ADDRESS = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    IERC20 public immutable usdcToken;
    
    enum PaymentToken { ETH, USDC }
    
    struct LibraryDependency {
        string dependencyProjectId; // Dependency project ID
        uint256 royaltyPercentage;  // Royalty percentage (1000 = 10%)
    }
    
    struct ProjectRoyalties {
        string projectId;
        LibraryDependency[] dependencies;
        uint256 totalRoyaltyETH;    // Sum of all ETH royalties
        uint256 totalRoyaltyUSDC;   // Sum of all USDC royalties
        bool hasRoyalties;
    }
    
    // Mapping from projectId to its royalty info
    mapping(string => ProjectRoyalties) public projectRoyalties;
    
    // Royalty percentage (10%)
    uint256 public constant ROYALTY_PERCENTAGE = 1000; // 10%
    uint256 public constant PERCENTAGE_DENOMINATOR = 10000;
    
    // Events
    event RoyaltiesRegistered(
        string indexed projectId,
        uint256 dependencyCount,
        uint256 totalRoyaltyETH,
        uint256 totalRoyaltyUSDC
    );
    
    event RoyaltiesPaid(
        string indexed projectId,
        string indexed dependencyId,
        address indexed creator,
        uint256 amountETH,
        uint256 amountUSDC
    );
    
    constructor() Ownable(msg.sender) {
        usdcToken = IERC20(USDC_ADDRESS);
    }
    
    /**
     * @notice Register library dependencies for a project
     * @param projectId The project being registered
     * @param dependencyIds Array of library project IDs used
     * @param dependencyCreators Array of original creators
     * @param dependencyPricesETH Array of original ETH prices
     * @param dependencyPricesUSDC Array of original USDC prices
     */
    function registerProjectRoyalties(
        string memory projectId,
        string[] memory dependencyIds,
        address[] memory dependencyCreators,
        uint256[] memory dependencyPricesETH,
        uint256[] memory dependencyPricesUSDC
    ) external {
        require(dependencyIds.length == dependencyCreators.length, "Length mismatch");
        require(dependencyIds.length == dependencyPricesETH.length, "Length mismatch");
        require(dependencyIds.length == dependencyPricesUSDC.length, "Length mismatch");
        require(!projectRoyalties[projectId].hasRoyalties, "Royalties already registered");
        
        uint256 totalRoyaltyETH = 0;
        uint256 totalRoyaltyUSDC = 0;
        
        ProjectRoyalties storage royalty = projectRoyalties[projectId];
        royalty.projectId = projectId;
        royalty.hasRoyalties = true;
        
        for (uint256 i = 0; i < dependencyIds.length; i++) {
            // Calculate 10% royalty
            uint256 royaltyETH = (dependencyPricesETH[i] * ROYALTY_PERCENTAGE) / PERCENTAGE_DENOMINATOR;
            uint256 royaltyUSDC = (dependencyPricesUSDC[i] * ROYALTY_PERCENTAGE) / PERCENTAGE_DENOMINATOR;
            
            LibraryDependency memory dep = LibraryDependency({
                projectId: dependencyIds[i],
                creator: dependencyCreators[i],
                royaltyETH: royaltyETH,
                royaltyUSDC: royaltyUSDC
            });
            
            royalty.dependencies.push(dep);
            totalRoyaltyETH += royaltyETH;
            totalRoyaltyUSDC += royaltyUSDC;
        }
        
        royalty.totalRoyaltyETH = totalRoyaltyETH;
        royalty.totalRoyaltyUSDC = totalRoyaltyUSDC;
        
        emit RoyaltiesRegistered(projectId, dependencyIds.length, totalRoyaltyETH, totalRoyaltyUSDC);
    }
    
    /**
     * @notice Get minimum allowed price for a project
     * @param projectId The project ID
     * @return minPriceETH Minimum ETH price
     * @return minPriceUSDC Minimum USDC price
     */
    function getMinimumPrice(string memory projectId) external view returns (uint256 minPriceETH, uint256 minPriceUSDC) {
        ProjectRoyalties storage royalty = projectRoyalties[projectId];
        return (royalty.totalRoyaltyETH, royalty.totalRoyaltyUSDC);
    }
    
    /**
     * @notice Validate that a price meets the minimum requirement
     * @param projectId The project ID
     * @param priceETH Proposed ETH price
     * @param priceUSDC Proposed USDC price
     */
    function validatePrice(
        string memory projectId,
        uint256 priceETH,
        uint256 priceUSDC
    ) external view returns (bool) {
        ProjectRoyalties storage royalty = projectRoyalties[projectId];
        
        if (!royalty.hasRoyalties) {
            return true; // No dependencies, any price is fine
        }
        
        // At least one price must meet or exceed the royalty requirement
        bool ethValid = priceETH >= royalty.totalRoyaltyETH;
        bool usdcValid = priceUSDC >= royalty.totalRoyaltyUSDC;
        
        return ethValid || usdcValid;
    }
    
    /**
     * @notice Distribute royalties when a project is purchased
     * @param projectId The project being purchased
     * @param paymentToken Payment token used (0: ETH, 1: USDC)
     */
    function distributeRoyalties(
        string memory projectId,
        PaymentToken paymentToken
    ) external payable nonReentrant {
        ProjectRoyalties storage royalty = projectRoyalties[projectId];
        require(royalty.hasRoyalties, "No royalties to distribute");
        
        if (paymentToken == PaymentToken.ETH) {
            require(msg.value >= royalty.totalRoyaltyETH, "Insufficient ETH for royalties");
            
            // Distribute to each dependency creator
            for (uint256 i = 0; i < royalty.dependencies.length; i++) {
                LibraryDependency memory dep = royalty.dependencies[i];
                if (dep.royaltyETH > 0) {
                    (bool success, ) = dep.creator.call{value: dep.royaltyETH}("");
                    require(success, "Royalty payment failed");
                    
                    emit RoyaltiesPaid(projectId, dep.projectId, dep.creator, dep.royaltyETH, 0);
                }
            }
            
            // Refund excess
            uint256 excess = msg.value - royalty.totalRoyaltyETH;
            if (excess > 0) {
                (bool success, ) = msg.sender.call{value: excess}("");
                require(success, "Refund failed");
            }
        } else {
            require(msg.value == 0, "Do not send ETH for USDC royalties");
            
            // Distribute USDC to each dependency creator
            for (uint256 i = 0; i < royalty.dependencies.length; i++) {
                LibraryDependency memory dep = royalty.dependencies[i];
                if (dep.royaltyUSDC > 0) {
                    require(
                        usdcToken.transferFrom(msg.sender, dep.creator, dep.royaltyUSDC),
                        "Royalty payment failed"
                    );
                    
                    emit RoyaltiesPaid(projectId, dep.projectId, dep.creator, 0, dep.royaltyUSDC);
                }
            }
        }
    }
    
    /**
     * @notice Get all dependencies for a project
     * @param projectId The project ID
     */
    function getProjectDependencies(string memory projectId) external view returns (LibraryDependency[] memory) {
        return projectRoyalties[projectId].dependencies;
    }
    
    /**
     * @notice Get total royalty amounts
     * @param projectId The project ID
     */
    function getTotalRoyalties(string memory projectId) external view returns (uint256 totalETH, uint256 totalUSDC) {
        ProjectRoyalties storage royalty = projectRoyalties[projectId];
        return (royalty.totalRoyaltyETH, royalty.totalRoyaltyUSDC);
    }
}

