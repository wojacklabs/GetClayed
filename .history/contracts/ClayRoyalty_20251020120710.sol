// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IClayLibrary {
    function getCurrentOwner(string memory projectId) external view returns (address);
}

/**
 * @title ClayRoyalty
 * @notice Tracks library dependencies and enforces minimum pricing with royalty distribution
 * @dev Ensures creators can't undercut by enforcing price floor based on used libraries
 */
contract ClayRoyalty is Ownable, ReentrancyGuard {
    // USDC token
    address public constant USDC_ADDRESS = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    IERC20 public immutable usdcToken;
    
    // Library contract reference
    IClayLibrary public libraryContract;
    
    // Pull Pattern: Pending royalties
    mapping(address => uint256) public pendingRoyaltiesETH;
    mapping(address => uint256) public pendingRoyaltiesUSDC;
    
    enum PaymentToken { ETH, USDC }
    
    struct LibraryDependency {
        string dependencyProjectId; // Dependency project ID
        uint256 royaltyPercentage;  // Royalty percentage (1000 = 10%)
    }
    
    struct ProjectRoyalties {
        string projectId;
        LibraryDependency[] dependencies;
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
        uint256 dependencyCount
    );
    
    event RoyaltyRecorded(
        string indexed projectId,
        address indexed recipient,
        uint256 amountETH,
        uint256 amountUSDC
    );
    
    event RoyaltyClaimed(
        address indexed claimant,
        uint256 amountETH,
        uint256 amountUSDC
    );
    
    constructor(address _libraryContract) Ownable(msg.sender) {
        usdcToken = IERC20(USDC_ADDRESS);
        libraryContract = IClayLibrary(_libraryContract);
    }
    
    /**
     * @notice Update library contract address (only owner)
     */
    function setLibraryContract(address _libraryContract) external onlyOwner {
        libraryContract = IClayLibrary(_libraryContract);
    }
    
    /**
     * @notice Register library dependencies for a project
     * @param projectId The project being registered
     * @param dependencyProjectIds Array of library project IDs used
     * @param royaltyPercentages Array of royalty percentages (1000 = 10%)
     */
    function registerProjectRoyalties(
        string memory projectId,
        string[] memory dependencyProjectIds,
        uint256[] memory royaltyPercentages
    ) external {
        require(dependencyProjectIds.length == royaltyPercentages.length, "Length mismatch");
        require(!projectRoyalties[projectId].hasRoyalties, "Royalties already registered");
        
        ProjectRoyalties storage royalty = projectRoyalties[projectId];
        royalty.projectId = projectId;
        royalty.hasRoyalties = true;
        
        for (uint256 i = 0; i < dependencyProjectIds.length; i++) {
            LibraryDependency memory dep = LibraryDependency({
                dependencyProjectId: dependencyProjectIds[i],
                royaltyPercentage: royaltyPercentages[i]
            });
            
            royalty.dependencies.push(dep);
        }
        
        emit RoyaltiesRegistered(projectId, dependencyProjectIds.length);
    }
    
    /**
     * @notice Calculate total royalties for a project based on price
     * @param projectId The project ID
     * @param priceETH Price in ETH
     * @param priceUSDC Price in USDC
     * @return totalETH Total ETH royalties
     * @return totalUSDC Total USDC royalties
     */
    function calculateTotalRoyalties(
        string memory projectId,
        uint256 priceETH,
        uint256 priceUSDC
    ) public view returns (uint256 totalETH, uint256 totalUSDC) {
        ProjectRoyalties storage royalty = projectRoyalties[projectId];
        
        if (!royalty.hasRoyalties) {
            return (0, 0);
        }
        
        for (uint256 i = 0; i < royalty.dependencies.length; i++) {
            LibraryDependency memory dep = royalty.dependencies[i];
            totalETH += (priceETH * dep.royaltyPercentage) / PERCENTAGE_DENOMINATOR;
            totalUSDC += (priceUSDC * dep.royaltyPercentage) / PERCENTAGE_DENOMINATOR;
        }
        
        return (totalETH, totalUSDC);
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

