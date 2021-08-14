
// @ts-ignore
import {deployments, ethers, getNamedAccounts } from "hardhat";
import {expect} from "./chai-setup";
import { advanceTimeAndBlockNTimes } from "./TimeTravel";

const EPOCH_SIZE = 17280;

const initialize = deployments.createFixture(async ({deployments, getNamedAccounts, ethers}, options) => {
    
    await deployments.fixture();
    const { deployer, user1, user2, user3 } = await getNamedAccounts();

    const cUSD = await deployments.get("TokenMock");
    const cUSDContract = await ethers.getContractAt("TokenMock", cUSD.address); 
    const DonationMiner = await deployments.get("DonationMiner");
    const DonationMinerContract = await ethers.getContractAt("DonationMiner", DonationMiner.address);
    const IPCT = await deployments.get("IPCTToken");
    const IPCTContract = await ethers.getContractAt("IPCTToken", IPCT.address);
    
    // Mint each of the test some cUSD 
    await cUSDContract.mint(user1, 1000);
    await cUSDContract.mint(user2, 2000);
    await cUSDContract.mint(user3, 3000);

    // Mint the DonationMiner some IPCT
    await IPCTContract.transfer(DonationMiner.address, 100000); 

    // Get signers for write tests
    const [ownerSigner, user1Signer, user2Signer, user3Signer] = await ethers.getSigners();

    console.log(`Owner is ${JSON.stringify(ownerSigner)}`);
    console.log(`User 1 is ${JSON.stringify(user1Signer)}`);
    console.log(`User 2 is ${JSON.stringify(user2Signer)}`);
    console.log(`User 3 is ${JSON.stringify(user3Signer)}`);

    return {    
        cUSD: {
            owner: deployer,
            deployed: cUSD,
            contract: cUSDContract
        },
        IPCT: {
            owner: deployer,
            deployed: IPCT,
            contract: IPCTContract
        },
        DonationMiner: {            
            owner: deployer,
            deployed: DonationMiner,
            contract: DonationMinerContract
        },
        signers: [ownerSigner, user1Signer, user2Signer, user3Signer]
    }
  }
);

describe('Donation Miner', () => {

    it('Should approve and donate 100 cUSD from user1', async function () {      

        const { cUSD, DonationMiner, signers } = await initialize();      
        
        // Approve from user1
        await cUSD.contract.connect(signers[1]).approve(DonationMiner.deployed.address, 200);
        console.log("Approved");

        // Confirm approval
        const allowance = await cUSD.contract.allowance(signers[1].getAddress(), DonationMiner.deployed.address);
        console.log(`Allowance is ${allowance}`);

        // Donate from user1 twice so the second time updates the pool
        await DonationMiner.contract.connect(signers[1]).donate(100);
        await DonationMiner.contract.connect(signers[1]).donate(100);

        // Advance 3 blocks
        await advanceTimeAndBlockNTimes(3, EPOCH_SIZE);        

        // Check their pending rewards
        const pendingRewards = await DonationMiner.contract.estimateClaimableReward(signers[1].getAddress());
        console.log(`Pending rewards = ${pendingRewards}`);
        
        // Expect 500 tokens: 100 tokens per block, and now five blocks have passed after donating twice
        expect(pendingRewards).to.equal("500"); 

        // Check their cUSD balance
        const userBalance = await cUSD.contract.balanceOf(signers[1].getAddress());
        expect(userBalance).to.equal("800");
    });

    it('Should approve and donate 100 cUSD from user1, advance time and claim their reward', async function () {      

        const { cUSD, IPCT, DonationMiner, signers } = await initialize();      
        
        // Approve from user1
        await cUSD.contract.connect(signers[1]).approve(DonationMiner.deployed.address, 200);
        console.log("Approved");

        // Confirm approval
        const allowance = await cUSD.contract.allowance(signers[1].getAddress(), DonationMiner.deployed.address);
        console.log(`Allowance is ${allowance}`);

        // Donate from user1 twice so the second time updates the pool
        await DonationMiner.contract.connect(signers[1]).donate(100);
        await DonationMiner.contract.connect(signers[1]).donate(100);

        // Advance 3 blocks
        await advanceTimeAndBlockNTimes(3, EPOCH_SIZE);        

        // Check their pending rewards
        const pendingRewards = await DonationMiner.contract.estimateClaimableReward(signers[1].getAddress());
        console.log(`Pending rewards = ${pendingRewards}`);

        // Claim their rewards
        await DonationMiner.contract.connect(signers[1]).claimRewards();
        console.log('Claimed rewards!');
        
        // Check their IPCT balance
        const rewardBalance = await IPCT.contract.balanceOf(signers[1].getAddress());
        expect(rewardBalance).to.equal("600");        
        
        // Check their cUSD balance
        const userBalance = await cUSD.contract.balanceOf(signers[1].getAddress());
        expect(userBalance).to.equal("800");
    });

});