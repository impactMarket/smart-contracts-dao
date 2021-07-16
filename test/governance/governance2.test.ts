// @ts-ignore
import chai from 'chai';
// @ts-ignore
import chaiAsPromised from 'chai-as-promised';
// @ts-ignore
import { ethers, network, artifacts, deployments, waffle} from "hardhat";
import type * as ethersTypes from "ethers";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {BigNumber} from "ethers";
const { expectRevert, expectEvent, time, constants } = require('@openzeppelin/test-helpers');
const RLP = require('rlp');

chai.use(chaiAsPromised);

const bigNum = (num: number) => (num + '0'.repeat(18))
const zeroAddress = '0x0000000000000000000000000000000000000000'
const expect = chai.expect;
const provider = waffle.provider;


// Contracts
let IPCTToken: ethersTypes.ContractFactory;
let IPCTDelegate: ethersTypes.ContractFactory;
let IPCTDelegator: ethersTypes.ContractFactory;
let IPCTTimelock: ethersTypes.ContractFactory;
let CommunityFactory: ethersTypes.ContractFactory;
let TestToken: ethersTypes.ContractFactory;

//users
let owner: SignerWithAddress;
let alice: SignerWithAddress;
let bob: SignerWithAddress;
let carol: SignerWithAddress;

// contract instances
let ipctToken: ethersTypes.Contract;
let ipctDelegate: ethersTypes.Contract;
let ipctDelegator: ethersTypes.Contract;
let ipctTimelock: ethersTypes.Contract;
let communityFactory: ethersTypes.Contract;
let testToken1: ethersTypes.Contract;
let testToken2: ethersTypes.Contract;
let testToken3: ethersTypes.Contract;

async function advanceNBlocks(n: number) {
  while (n) {
    n--;
    await network.provider.send("evm_mine")
  }
}

async function getNextAddr(sender: string, offset = 0) {
  const nonce = await provider.getTransactionCount(sender)
  return (
      '0x' +
      ethers.utils
          .keccak256(RLP.encode([sender, Number(nonce) + Number(offset)]))
          .slice(12)
          .substring(14)
  )
}

describe("IPCTGovernator", function() {
  before(async function () {
    CommunityFactory = await ethers.getContractFactory("CommunityFactory");
    IPCTToken = await ethers.getContractFactory("IPCTToken");
    IPCTDelegate = await ethers.getContractFactory("IPCTDelegateMock");
    IPCTDelegator = await ethers.getContractFactory("IPCTDelegatorMock");
    IPCTTimelock = await ethers.getContractFactory("IPCTTimelockMock");
    TestToken = await ethers.getContractFactory("TokenMock");

    const accounts: SignerWithAddress[] =  await ethers.getSigners();

    owner = accounts[0];
    alice = accounts[1];
    bob = accounts[2];
    carol = accounts[3];

    console.log('owner:    ' + owner.address);
    console.log('alice:    ' + alice.address);
    console.log('bob:      ' + bob.address);
    console.log('carol:    ' + carol.address);
  });

  beforeEach(async function () {
    testToken1 = await TestToken.deploy("Test Token #1", "TT1");
    await testToken1.mint(owner.address, bigNum(1000000));
    testToken2 = await TestToken.deploy("Test Token #2", "TT2");
    await testToken2.mint(owner.address, bigNum(1000000));
    testToken3 = await TestToken.deploy("Test Token #3", "TT3");
    await testToken3.mint(owner.address, bigNum(1000000));

    // ipctToken = await IPCTToken.deploy(owner.address, owner.address, 1723332078);
    ipctToken = await IPCTToken.deploy(owner.address);
    ipctDelegate = await IPCTDelegate.deploy();

    const delegatorExpectedAddress = await getNextAddr(owner.address, 1);

    ipctTimelock = await IPCTTimelock.deploy(delegatorExpectedAddress, 0);

    ipctDelegator = await IPCTDelegator.deploy(
        ipctTimelock.address,
        ipctToken.address,
        zeroAddress,
        ipctTimelock.address,
        ipctDelegate.address,
        17280,
        1,
        bigNum(1000000)
    );

    ipctDelegator = await IPCTDelegate.attach(ipctDelegator.address);
    await ipctDelegator._setVotingPeriod(5)


    communityFactory = await CommunityFactory.deploy(testToken1.address, ipctTimelock.address);

    await ipctToken.transfer(alice.address, bigNum(1000001));
    await ipctToken.transfer(bob.address, bigNum(1000001));
    await ipctToken.transfer(carol.address, bigNum(1000001));

    await ipctToken.delegate(owner.address);
    await ipctToken.connect(alice).delegate(alice.address);
    await ipctToken.connect(bob).delegate(bob.address);
    await ipctToken.connect(carol).delegate(carol.address);

    // console.log(': ' + .address);
  });

  it("should create community", async function() {
    await ipctToken.transfer(ipctDelegator.address, bigNum(1234));

    const targets = [communityFactory.address];
    const values = [0];
    const signatures = ['createCommunity(address,uint256,uint256,uint256,uint256)'];
    const calldatas = [ethers.utils.defaultAbiCoder.encode(['address','uint256','uint256','uint256','uint256'],
        [alice.address, bigNum(100), bigNum(1000), 1111, 111])];
    const descriptions = 'description';

    await ipctDelegator.propose(targets, values, signatures, calldatas, descriptions);

    await advanceNBlocks(1);

    await ipctDelegator.castVote(1, 1);
    await ipctDelegator.connect(alice).castVote(1, 1);

    await advanceNBlocks(6);

    await network.provider.send("evm_increaseTime", [1000000]);

    await ipctDelegator.connect(alice).queue(1);

    await ipctDelegator.connect(alice).execute(1);

    await expect(communityFactory.communities(1)).to.be.fulfilled;
  });

  // it("should create community by signers", async function() {
  //   await token.transfer(governor.address, bigNum(1234));
  //
  //   const target = communityFactory.address;
  //   const value = 0;
  //   const signature = 'createCommunity(address,uint256,uint256,uint256,uint256)';
  //   const data = ethers.utils.defaultAbiCoder.encode(['address','uint256','uint256','uint256','uint256'],
  //       [alice.address, bigNum(100), bigNum(1000), 1111, 111]);
  //   const description = 'description';
  //
  //   await governor.connect(alice).proposeByAdmin(target, value, signature, data, description);
  //
  //   await governor.signProposal(1);
  //
  //   await governor.connect(alice).signProposal(1);
  //
  //   await network.provider.send("evm_increaseTime", [1000000]);
  //
  //   await governor.connect(alice).executeByAdmin(1);
  // });
});
