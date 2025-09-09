// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IClayLibrary {
    function getCurrentOwner(string memory projectId) external view returns (address);
    function getRoyaltyFee(string memory projectId) external view returns (uint256 royaltyETH, uint256 royaltyUSDC);
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
        uint256 fixedRoyaltyETH;    // Fixed royalty in ETH (based on dependency price at registration)
        uint256 fixedRoyaltyUSDC;   // Fixed royalty in USDC (based on dependency price at registration)
        bool isDirect;              // Whether this is a direct import (new field for hierarchical royalties)
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
    
    // CRITICAL FIX: Track total royalties actually paid for each project
    // This prevents marketplace underpricing by ensuring sale price > paid royalties
    mapping(string => uint256) public totalRoyaltiesPaidETH;
    mapping(string => uint256) public totalRoyaltiesPaidUSDC;
    
    // For hierarchical royalty distribution
    mapping(string => string[]) public projectDirectDependencies; // Track only direct imports
    // DEPRECATED: No longer needed with auto-distribution
    // mapping(address => mapping(string => uint256)) public pendingDistributionsETH;
    // mapping(address => mapping(string => uint256)) public pendingDistributionsUSDC;
    
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
     * @param directDependencyIds Array of direct import library project IDs (for hierarchical royalties)
     */
    function registerProjectRoyalties(
        string memory projectId,
        string[] memory dependencyProjectIds,
        string[] memory directDependencyIds
    ) external {
        require(!projectRoyalties[projectId].hasRoyalties, "Royalties already registered");
        
        ProjectRoyalties storage royalty = projectRoyalties[projectId];
        royalty.projectId = projectId;
        royalty.hasRoyalties = true;
        
        // Store direct dependencies
        for (uint256 j = 0; j < directDependencyIds.length; j++) {
            projectDirectDependencies[projectId].push(directDependencyIds[j]);
        }
        
        for (uint256 i = 0; i < dependencyProjectIds.length; i++) {
            // Get current royalty fee from Library at registration time
            (uint256 feeETH, uint256 feeUSDC) = libraryContract.getRoyaltyFee(dependencyProjectIds[i]);
            
            // Check if this is a direct dependency
            bool isDirect = false;
            for (uint256 k = 0; k < directDependencyIds.length; k++) {
                if (keccak256(bytes(directDependencyIds[k])) == keccak256(bytes(dependencyProjectIds[i]))) {
                    isDirect = true;
                    break;
                }
            }
            
            LibraryDependency memory dep = LibraryDependency({
                dependencyProjectId: dependencyProjectIds[i],
                royaltyPercentage: 10000, // Not used anymore, kept for compatibility
                fixedRoyaltyETH: feeETH,
                fixedRoyaltyUSDC: feeUSDC,
                isDirect: isDirect
            });
            
            royalty.dependencies.push(dep);
        }
        
        emit RoyaltiesRegistered(projectId, dependencyProjectIds.length);
    }
    
    /**
     * @notice Calculate total royalties for a project (fixed amounts)
     * @dev FIX: Only counts active libraries (not deleted ones)
     * @dev HIERARCHICAL: Only counts DIRECT dependencies for user payment
     * @param projectId The project ID
     * @return totalETH Total ETH royalties from active DIRECT libraries
     * @return totalUSDC Total USDC royalties from active DIRECT libraries
     */
    function calculateTotalRoyalties(string memory projectId) public view returns (uint256 totalETH, uint256 totalUSDC) {
        ProjectRoyalties storage royalty = projectRoyalties[projectId];
        
        if (!royalty.hasRoyalties) {
            return (0, 0);
        }
        
        // HIERARCHICAL: Sum up fixed royalties only for DIRECT dependencies
        for (uint256 i = 0; i < royalty.dependencies.length; i++) {
            LibraryDependency memory dep = royalty.dependencies[i];
            
            // Skip indirect dependencies (they will be paid by their parent libraries)
            if (!dep.isDirect) {
                continue;
            }
            
            // Check if library still exists
            address owner = libraryContract.getCurrentOwner(dep.dependencyProjectId);
            
            // Only count if library exists (owner != 0)
            if (owner != address(0)) {
                totalETH += dep.fixedRoyaltyETH;
                totalUSDC += dep.fixedRoyaltyUSDC;
            }
        }
        
        return (totalETH, totalUSDC);
    }
    
    /**
     * @notice Record royalties when a project is purchased (Pull Pattern)
     * @param projectId The project being purchased
     * @param price The price paid (unused, kept for interface compatibility)
     * @param paymentToken Payment token used (0: ETH, 1: USDC)
     */
    function recordRoyalties(
        string memory projectId,
        uint256 price,
        PaymentToken paymentToken
    ) external payable nonReentrant {
        ProjectRoyalties storage royalty = projectRoyalties[projectId];
        require(royalty.hasRoyalties, "No royalties for this project");
        
        if (paymentToken == PaymentToken.ETH) {
            require(msg.value > 0, "No ETH sent");
            
            // HIERARCHICAL: Calculate total needed for DIRECT dependencies only
            uint256 totalETHNeeded = 0;
            for (uint256 i = 0; i < royalty.dependencies.length; i++) {
                LibraryDependency memory dep = royalty.dependencies[i];
                
                // Skip indirect dependencies
                if (!dep.isDirect) {
                    continue;
                }
                
                address owner = libraryContract.getCurrentOwner(dep.dependencyProjectId);
                
                // Only count if library still exists (owner != 0)
                if (dep.fixedRoyaltyETH > 0 && owner != address(0)) {
                    totalETHNeeded += dep.fixedRoyaltyETH;
                }
            }
            
            require(msg.value >= totalETHNeeded, "Insufficient ETH sent");
            
            // HIERARCHICAL: Auto-distribute royalties to all dependencies
            for (uint256 i = 0; i < royalty.dependencies.length; i++) {
                LibraryDependency memory dep = royalty.dependencies[i];
                
                // Skip indirect dependencies
                if (!dep.isDirect) {
                    continue;
                }
                
                // Get current owner of dependency (dynamic ownership support)
                address owner = libraryContract.getCurrentOwner(dep.dependencyProjectId);
                
                // Use fixed royalty amount (calculated at registration time)
                uint256 royaltyAmount = dep.fixedRoyaltyETH;
                
                if (royaltyAmount > 0 && owner != address(0)) {
                    // Calculate how much this library needs to pay its own dependencies
                    uint256 subDependenciesTotal = 0;
                    ProjectRoyalties storage libRoyalty = projectRoyalties[dep.dependencyProjectId];
                    
                    // Auto-distribute to sub-dependencies
                    if (libRoyalty.hasRoyalties) {
                        for (uint256 j = 0; j < libRoyalty.dependencies.length; j++) {
                            LibraryDependency memory subDep = libRoyalty.dependencies[j];
                            address subOwner = libraryContract.getCurrentOwner(subDep.dependencyProjectId);
                            
                            if (subDep.fixedRoyaltyETH > 0 && subOwner != address(0)) {
                                pendingRoyaltiesETH[subOwner] += subDep.fixedRoyaltyETH;
                                subDependenciesTotal += subDep.fixedRoyaltyETH;
                                emit RoyaltyRecorded(dep.dependencyProjectId, subOwner, subDep.fixedRoyaltyETH, 0);
                            }
                        }
                    }
                    
                    // Library owner gets the remainder (their profit)
                    require(royaltyAmount >= subDependenciesTotal, "Library royalty less than dependencies");
                    uint256 libraryProfit = royaltyAmount - subDependenciesTotal;
                    
                    pendingRoyaltiesETH[owner] += libraryProfit;
                    emit RoyaltyRecorded(projectId, owner, libraryProfit, 0);
                }
            }
            
            // CRITICAL FIX: Store total royalties paid for marketplace minimum price validation
            totalRoyaltiesPaidETH[projectId] = totalETHNeeded;
            
            // Refund excess ETH if any
            if (msg.value > totalETHNeeded) {
                (bool success, ) = msg.sender.call{value: msg.value - totalETHNeeded}("");
                require(success, "Refund failed");
            }
        } else {
            require(msg.value == 0, "Do not send ETH for USDC royalties");
            
            // HIERARCHICAL: Calculate total USDC needed for DIRECT dependencies only
            uint256 totalUSDC = 0;
            for (uint256 i = 0; i < royalty.dependencies.length; i++) {
                LibraryDependency memory dep = royalty.dependencies[i];
                
                // Skip indirect dependencies
                if (!dep.isDirect) {
                    continue;
                }
                
                address owner = libraryContract.getCurrentOwner(dep.dependencyProjectId);
                
                // Only count if library still exists (owner != 0)
                if (dep.fixedRoyaltyUSDC > 0 && owner != address(0)) {
                    totalUSDC += dep.fixedRoyaltyUSDC;
                }
            }
            
            require(totalUSDC > 0, "No USDC royalties for this project");
            
            // Transfer USDC from payer to this contract
            require(
                usdcToken.transferFrom(msg.sender, address(this), totalUSDC),
                "USDC transfer to contract failed"
            );
            
            // HIERARCHICAL: Auto-distribute USDC royalties to all dependencies
            for (uint256 i = 0; i < royalty.dependencies.length; i++) {
                LibraryDependency memory dep = royalty.dependencies[i];
                
                // Skip indirect dependencies
                if (!dep.isDirect) {
                    continue;
                }
                
                // Get current owner of dependency (dynamic ownership support)
                address owner = libraryContract.getCurrentOwner(dep.dependencyProjectId);
                
                // Use fixed royalty amount (calculated at registration time)
                uint256 royaltyAmount = dep.fixedRoyaltyUSDC;
                
                if (royaltyAmount > 0 && owner != address(0)) {
                    // Calculate how much this library needs to pay its own dependencies
                    uint256 subDependenciesTotal = 0;
                    ProjectRoyalties storage libRoyalty = projectRoyalties[dep.dependencyProjectId];
                    
                    // Auto-distribute to sub-dependencies
                    if (libRoyalty.hasRoyalties) {
                        for (uint256 j = 0; j < libRoyalty.dependencies.length; j++) {
                            LibraryDependency memory subDep = libRoyalty.dependencies[j];
                            address subOwner = libraryContract.getCurrentOwner(subDep.dependencyProjectId);
                            
                            if (subDep.fixedRoyaltyUSDC > 0 && subOwner != address(0)) {
                                pendingRoyaltiesUSDC[subOwner] += subDep.fixedRoyaltyUSDC;
                                subDependenciesTotal += subDep.fixedRoyaltyUSDC;
                                emit RoyaltyRecorded(dep.dependencyProjectId, subOwner, 0, subDep.fixedRoyaltyUSDC);
                            }
                        }
                    }
                    
                    // Library owner gets the remainder (their profit)
                    require(royaltyAmount >= subDependenciesTotal, "Library royalty less than dependencies");
                    uint256 libraryProfit = royaltyAmount - subDependenciesTotal;
                    
                    pendingRoyaltiesUSDC[owner] += libraryProfit;
                    emit RoyaltyRecorded(projectId, owner, 0, libraryProfit);
                }
            }
            
            // CRITICAL FIX: Store total royalties paid for marketplace minimum price validation
            totalRoyaltiesPaidUSDC[projectId] = totalUSDC;
        }
    }
    
    /**
     * @notice Claim pending ETH royalties (Pull Pattern)
     */
    function claimRoyaltiesETH() external nonReentrant {
        uint256 pending = pendingRoyaltiesETH[msg.sender];
        require(pending > 0, "No pending ETH royalties");
        
        pendingRoyaltiesETH[msg.sender] = 0;
        
        (bool success, ) = msg.sender.call{value: pending}("");
        require(success, "ETH transfer failed");
        
        emit RoyaltyClaimed(msg.sender, pending, 0);
    }
    
    /**
     * @notice Claim pending USDC royalties (Pull Pattern)
     */
    function claimRoyaltiesUSDC() external nonReentrant {
        uint256 pending = pendingRoyaltiesUSDC[msg.sender];
        require(pending > 0, "No pending USDC royalties");
        
        pendingRoyaltiesUSDC[msg.sender] = 0;
        
        require(usdcToken.transfer(msg.sender, pending), "USDC transfer failed");
        
        emit RoyaltyClaimed(msg.sender, 0, pending);
    }
    
    /**
     * @notice Get pending royalties for an address
     * @param account The account to check
     */
    function getPendingRoyalties(address account) external view returns (uint256 eth, uint256 usdc) {
        return (pendingRoyaltiesETH[account], pendingRoyaltiesUSDC[account]);
    }
    
    /**
     * @notice Get all dependencies for a project
     * @param projectId The project ID
     */
    function getProjectDependencies(string memory projectId) external view returns (LibraryDependency[] memory) {
        return projectRoyalties[projectId].dependencies;
    }
    
    /**
     * @notice DEPRECATED: No longer needed with auto-distribution
     * @dev Royalties are now automatically distributed to all dependencies at payment time
     * @param libraryProjectId The library project ID (unused)
     */
    function distributeNestedRoyalties(string memory libraryProjectId) external pure {
        revert("Function deprecated: Royalties are now auto-distributed at payment time");
    }
    
    /**
     * @notice Fallback to receive ETH
     */
    receive() external payable {}
}

