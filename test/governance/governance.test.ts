// // @ts-ignore
// import chai from 'chai';
// // @ts-ignore
// import chaiAsPromised from 'chai-as-promised';
// // @ts-ignore
// import { ethers, network, artifacts, deployments } from "hardhat";
// import type * as ethersTypes from "ethers";
// import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
// const { expectRevert, expectEvent, time, constants } = require('@openzeppelin/test-helpers');
//
// chai.use(chaiAsPromised);
//
// const bigNum = (num: number) => (num + '0'.repeat(18))
// const zeroAddress = '0x0000000000000000000000000000000000000000'
// const expect = chai.expect;
//
// // Contracts
// let CommunityFactory: ethersTypes.ContractFactory;
// let IPCT: ethersTypes.ContractFactory;
// let IPCTGovernor: ethersTypes.ContractFactory;
// let TestToken: ethersTypes.ContractFactory;
//
// //users
// let owner: SignerWithAddress;
// let alice: SignerWithAddress;
// let bob: SignerWithAddress;
// let carol: SignerWithAddress;
//
// // contract instances
// let token: ethersTypes.Contract;
// let governor: ethersTypes.Contract;
// let communityFactory: ethersTypes.Contract;
// let testToken1: ethersTypes.Contract;
// let testToken2: ethersTypes.Contract;
// let testToken3: ethersTypes.Contract;
//
// async function advanceNBlocks(n: number) {
//   while (n) {
//     n--;
//     await network.provider.send("evm_mine")
//   }
// }
//
// describe("IPCTGovernator", function() {
//
//
//   before(async function () {
//     CommunityFactory = await ethers.getContractFactory("CommunityFactory");
//     IPCT = await ethers.getContractFactory("IPCT");
//     IPCTGovernor = await ethers.getContractFactory("IPCTGovernor");
//     TestToken = await ethers.getContractFactory("Token");
//
//     const accounts: SignerWithAddress[] =  await ethers.getSigners();
//
//     owner = accounts[0];
//     alice = accounts[1];
//     bob = accounts[2];
//     carol = accounts[3];
//
//     console.log('owner:    ' + owner.address);
//     console.log('alice:    ' + alice.address);
//     console.log('bob:      ' + bob.address);
//     console.log('carol:    ' + carol.address);
//   });
//
//   beforeEach(async function () {
//     testToken1 = await TestToken.deploy("Test Token #1", "TT1");
//      await testToken1.mint(owner.address, bigNum(1000000));
//     testToken2 = await TestToken.deploy("Test Token #2", "TT2");
//      await testToken2.mint(owner.address, bigNum(1000000));
//     testToken3 = await TestToken.deploy("Test Token #3", "TT3");
//      await testToken3.mint(owner.address, bigNum(1000000));
//
//     token = await IPCT.deploy(owner.address, owner.address, 1723332078);
//     // await token.deployed();
//
//     governor = await IPCTGovernor.deploy(token.address, [owner.address, alice.address], 1);
//     // await governor.deployed();
//
//     communityFactory = await CommunityFactory.deploy(testToken1.address, governor.address);
//
//
//     await token.transfer(alice.address, bigNum(1000001));
//     await token.transfer(bob.address, bigNum(1000001));
//     await token.transfer(carol.address, bigNum(1000001));
//
//     await token.delegate(owner.address);
//     await token.connect(alice).delegate(alice.address);
//     await token.connect(bob).delegate(bob.address);
//     await token.connect(carol).delegate(carol.address);
//
//
//     console.log('-----------------------------------------------');
//     console.log('token:     ' + token.address);
//     console.log('governance:      ' + governor.address);
//   });
//
//   // signers tests
//   it("should have correct number of signers", async function() {
//     expect(await governor.isAdmin(owner.address)).to.be.true;
//     expect(await governor.isAdmin(alice.address)).to.be.true;
//
//     await expect(governor.admins(0)).to.be.fulfilled;
//     await expect(governor.admins(1)).to.be.fulfilled;
//     await expect(governor.admins(2)).to.be.rejected;
//   });
//
//
//   // it("should send founds", async function() {
//   //   console.log('********************');
//   //
//   //   await token.transfer(governor.address, bigNum(1234));
//   //
//   //   await governor.proposeSendMoney(token.address, carol.address, bigNum(1234), 'description');
//   //
//   //   // await governor.castVote(1, true);   evm_mine
//   //
//   //
//   //   await advanceNBlocks(11);
//   //   // await time.advanceBlockTo(parseInt(await time.latestBlock()) + 1);;
//   //
//   //
//   //   await governor.castVote(1, true);
//   //   await governor.connect(alice).castVote(1, true);
//   //
//   //   await advanceNBlocks(21);
//   //
//   //
//   //   await governor.queue(1);
//   //   await network.provider.send("evm_increaseTime", [1000000]);
//   //   // await advanceNBlocks(1);
//   //
//   //   console.log(smallNum(await token.balanceOf(carol.address)));
//   //
//   //   await governor.connect(alice).execute(1);
//   //
//   //   console.log(smallNum(await token.balanceOf(carol.address)));
//   //
//   //   // console.log(await governor.proposals(1));
//   //
//   //
//   //   // console.log(await governor.getActions(1));
//   //
//   //
//   //   // await governor.connect(alice).propose([carol.address], [2000], ['signatures'], [12345678], 'description');
//   //
//   //   // console.log('//*/*/*/*/*/*/*/*/*/*/*/*/**//**//*//*/*/');
//   //   // await token.transfer(governor.address, bigNum(1234));
//   // });
//   //
//
//   it("should create community by holders", async function() {
//     await token.transfer(governor.address, bigNum(1234));
//
//     const target = communityFactory.address;
//     const value = 0;
//     const signature = 'createCommunity(address,uint256,uint256,uint256,uint256)';
//     const data = ethers.utils.defaultAbiCoder.encode(['address','uint256','uint256','uint256','uint256'],
//         [alice.address, bigNum(100), bigNum(1000), 1111, 111]);
//     const description = 'description';
//
//     await governor.propose(target, value, signature, data, description);
//
//     await advanceNBlocks(11);
//
//     await governor.castVote(1, true);
//     await governor.connect(alice).castVote(1, true);
//
//     await advanceNBlocks(21);
//
//     await network.provider.send("evm_increaseTime", [1000000]);
//
//     await governor.connect(alice).execute(1);
//   });
//
//   it("should create community by signers", async function() {
//     await token.transfer(governor.address, bigNum(1234));
//
//     const target = communityFactory.address;
//     const value = 0;
//     const signature = 'createCommunity(address,uint256,uint256,uint256,uint256)';
//     const data = ethers.utils.defaultAbiCoder.encode(['address','uint256','uint256','uint256','uint256'],
//         [alice.address, bigNum(100), bigNum(1000), 1111, 111]);
//     const description = 'description';
//
//     await governor.connect(alice).proposeByAdmin(target, value, signature, data, description);
//
//     await governor.signProposal(1);
//
//     await governor.connect(alice).signProposal(1);
//
//     await network.provider.send("evm_increaseTime", [1000000]);
//
//     await governor.connect(alice).executeByAdmin(1);
//   });
// });
