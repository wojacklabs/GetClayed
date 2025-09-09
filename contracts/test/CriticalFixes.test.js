const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Critical Fixes Verification", function () {
  let library, marketplace, royalty;
  let owner, seller, buyer1, buyer2;
  let mockUSDC;
  
  beforeEach(async function () {
    [owner, seller, buyer1, buyer2] = await ethers.getSigners();
    
    // Deploy mock USDC
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockUSDC = await MockERC20.deploy("USD Coin", "USDC", 6);
    
    // Deploy contracts
    const ClayLibrary = await ethers.getContractFactory("ClayLibrary");
    const ClayRoyalty = await ethers.getContractFactory("ClayRoyalty");
    const ClayMarketplace = await ethers.getContractFactory("ClayMarketplace");
    
    royalty = await ClayRoyalty.deploy(ethers.ZeroAddress); // Will set later
    library = await ClayLibrary.deploy(await royalty.getAddress());
    
    await royalty.setLibraryContract(await library.getAddress());
    
    marketplace = await ClayMarketplace.deploy(
      await library.getAddress(),
      await royalty.getAddress()
    );
    
    await library.setApprovedMarketplace(await marketplace.getAddress(), true);
  });
  
  describe("C3: Total Royalties Paid Tracking", function () {
    it("Should store total royalties paid in ETH", async function () {
      // Register library
      await library.connect(seller).registerAsset(
        "lib1",
        "Test Library",
        "Description",
        ethers.parseEther("0.001"),
        0
      );
      
      // Register project with dependency
      await royalty.connect(buyer1).registerProjectRoyalties("proj1", ["lib1"]);
      
      // Pay royalties
      await royalty.connect(buyer1).recordRoyalties(
        "proj1",
        0,
        0,
        { value: ethers.parseEther("0.001") }
      );
      
      // Verify stored amount
      const paidETH = await royalty.totalRoyaltiesPaidETH("proj1");
      expect(paidETH).to.equal(ethers.parseEther("0.001"));
    });
    
    it("Should track royalties even if library is deleted later", async function () {
      // Register 2 libraries
      await library.connect(seller).registerAsset(
        "lib1",
        "Library A",
        "Desc",
        ethers.parseEther("0.001"),
        0
      );
      
      await library.connect(seller).registerAsset(
        "lib2",
        "Library B",
        "Desc",
        ethers.parseEther("0.002"),
        0
      );
      
      // Create project using both
      await royalty.connect(buyer1).registerProjectRoyalties("proj1", ["lib1", "lib2"]);
      await royalty.connect(buyer1).recordRoyalties(
        "proj1",
        0,
        0,
        { value: ethers.parseEther("0.003") }
      );
      
      // Verify stored amount
      const paidETH = await royalty.totalRoyaltiesPaidETH("proj1");
      expect(paidETH).to.equal(ethers.parseEther("0.003"));
      
      // Delete lib1
      await library.connect(seller).deleteAsset("lib1");
      
      // Stored amount should NOT change
      const paidETHAfter = await royalty.totalRoyaltiesPaidETH("proj1");
      expect(paidETHAfter).to.equal(ethers.parseEther("0.003"));
    });
  });
  
  describe("C2: Marketplace Price Validation", function () {
    it("Should prevent listing below paid royalties", async function () {
      // Setup: Register library and create project
      await library.connect(seller).registerAsset(
        "lib1",
        "Library",
        "Desc",
        ethers.parseEther("0.001"),
        0
      );
      
      await royalty.connect(buyer1).registerProjectRoyalties("proj1", ["lib1"]);
      await royalty.connect(buyer1).recordRoyalties(
        "proj1",
        0,
        0,
        { value: ethers.parseEther("0.001") }
      );
      
      // Transfer ownership to buyer1
      await library.connect(seller).transferAssetOwnership("lib1", buyer1.address);
      
      // Register project as library asset
      await library.connect(buyer1).registerAsset(
        "proj1",
        "Project",
        "Desc",
        0,
        0
      );
      
      // Try to list below paid royalties (should fail)
      await expect(
        marketplace.connect(buyer1).listAsset("proj1", ethers.parseEther("0.0005"), 0)
      ).to.be.revertedWith("Price must be higher than royalties paid");
      
      // List above paid royalties (should succeed)
      await marketplace.connect(buyer1).listAsset("proj1", ethers.parseEther("0.002"), 0);
    });
    
    it("Should use paid amount even if library deleted", async function () {
      // Create project with 2 libraries (0.003 ETH total)
      await library.connect(seller).registerAsset("lib1", "A", "D", ethers.parseEther("0.001"), 0);
      await library.connect(seller).registerAsset("lib2", "B", "D", ethers.parseEther("0.002"), 0);
      
      await royalty.connect(buyer1).registerProjectRoyalties("proj1", ["lib1", "lib2"]);
      await royalty.connect(buyer1).recordRoyalties("proj1", 0, 0, { value: ethers.parseEther("0.003") });
      
      // Register project as library
      await library.connect(buyer1).registerAsset("proj1", "Proj", "D", 0, 0);
      
      // Delete lib1
      await library.connect(seller).deleteAsset("lib1");
      
      // Try to list at 0.0025 ETH (below 0.003 paid, but above 0.002 remaining)
      await expect(
        marketplace.connect(buyer1).listAsset("proj1", ethers.parseEther("0.0025"), 0)
      ).to.be.revertedWith("Price must be higher than royalties paid");
      
      // List at 0.004 ETH (above paid amount)
      await marketplace.connect(buyer1).listAsset("proj1", ethers.parseEther("0.004"), 0);
    });
  });
  
  describe("H1: Offer Auto-Refund on Cancel Listing", function () {
    it("Should refund all offers when listing cancelled", async function () {
      // Setup listing
      await library.connect(seller).registerAsset("proj1", "Proj", "D", 0, 0);
      await marketplace.connect(seller).listAsset("proj1", ethers.parseEther("0.01"), 0);
      
      // Create 2 offers
      await marketplace.connect(buyer1).makeOffer(
        "proj1",
        ethers.parseEther("0.008"),
        0,
        86400,
        { value: ethers.parseEther("0.008") }
      );
      
      await marketplace.connect(buyer2).makeOffer(
        "proj1",
        ethers.parseEther("0.009"),
        0,
        86400,
        { value: ethers.parseEther("0.009") }
      );
      
      const buyer1Before = await ethers.provider.getBalance(buyer1.address);
      const buyer2Before = await ethers.provider.getBalance(buyer2.address);
      
      // Cancel listing
      await marketplace.connect(seller).cancelListing("proj1");
      
      const buyer1After = await ethers.provider.getBalance(buyer1.address);
      const buyer2After = await ethers.provider.getBalance(buyer2.address);
      
      // Both should be refunded
      expect(buyer1After - buyer1Before).to.equal(ethers.parseEther("0.008"));
      expect(buyer2After - buyer2Before).to.equal(ethers.parseEther("0.009"));
    });
  });
  
  describe("C1: Deleted Project Purchase Prevention", function () {
    it("Should prevent purchase of deleted project", async function () {
      // Setup
      await library.connect(seller).registerAsset("proj1", "Proj", "D", 0, 0);
      await marketplace.connect(seller).listAsset("proj1", ethers.parseEther("0.01"), 0);
      
      // Delete project
      await library.connect(seller).deleteAsset("proj1");
      
      // Try to buy (should fail in contract)
      await expect(
        marketplace.connect(buyer1).buyAsset("proj1", { value: ethers.parseEther("0.01") })
      ).to.be.revertedWith("Asset not found in library");
    });
  });
});

// Mock ERC20 for testing
// You'll need to create this or use OpenZeppelin mock


