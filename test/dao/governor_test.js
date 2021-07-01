var chai = require("chai");
var chaiAsPromised = require("chai-as-promised");
const { time } = require('@openzeppelin/test-helpers');

chai.use(chaiAsPromised);
 
var expect = chai.expect;

const bigNum = num=>(num + '0'.repeat(18))
const smallNum = num=>(parseInt(num)/bigNum(1))
const zeroAddress = '0x0000000000000000000000000000000000000000'

async function advanceNBlocks(n) {
  while (n) {
    n--;
    await network.provider.send("evm_mine")
  }
}

describe("IPCTGovernator", function() {
  before(async function () {
    this.CommunityFactory = await ethers.getContractFactory("CommunityFactory");
    this.IPCT = await ethers.getContractFactory("IPCT");
    this.IPCTGovernor = await ethers.getContractFactory("IPCTGovernor");
    this.TestToken = await ethers.getContractFactory("TestToken");

    [
      this.owner, 
      this.alice,
      this.bob,
      this.carol,
      ...accounts
    ] = await ethers.getSigners();

    console.log('owner:    ' + this.owner.address);
    console.log('alice:    ' + this.alice.address);
    console.log('bob:      ' + this.bob.address);
    console.log('carol:    ' + this.carol.address);
  });

  beforeEach(async function () {
    this.testToken1 = await this.TestToken.deploy("Test Token #1", "TT1", bigNum(1000000));
    this.testToken2 = await this.TestToken.deploy("Test Token #2", "TT2", bigNum(1000000));
    this.testToken3 = await this.TestToken.deploy("Test Token #3", "TT3", bigNum(1000000));

    this.token = await this.IPCT.deploy(this.owner.address, this.owner.address, 1723332078);
    // await this.token.deployed();

    this.governor = await this.IPCTGovernor.deploy(this.token.address, [this.owner.address, this.alice.address], 1);
    // await this.governor.deployed();

    this.communityFactory = await this.CommunityFactory.deploy(this.testToken1.address, this.governor.address);


    await this.token.transfer(this.alice.address, bigNum(1000001));
    await this.token.transfer(this.bob.address, bigNum(1000001));
    await this.token.transfer(this.carol.address, bigNum(1000001));

    await this.token.delegate(this.owner.address);
    await this.token.connect(this.alice).delegate(this.alice.address);
    await this.token.connect(this.bob).delegate(this.bob.address);
    await this.token.connect(this.carol).delegate(this.carol.address);


    console.log('-----------------------------------------------');
    console.log('token:     ' + this.token.address);
    console.log('governance:      ' + this.governor.address);
  });

  // signers tests
  it("should have correct number of signers", async function() {
    expect(await this.governor.isSigner(this.owner.address)).to.be.true;
    expect(await this.governor.isSigner(this.alice.address)).to.be.true;

    await expect(this.governor.signers(0)).to.be.fulfilled;
    await expect(this.governor.signers(1)).to.be.fulfilled;
    await expect(this.governor.signers(2)).to.be.rejected;
  });


  // it("should send founds", async function() {
  //   console.log('********************');
  //
  //   await this.token.transfer(this.governor.address, bigNum(1234));
  //
  //   await this.governor.proposeSendMoney(this.token.address, this.carol.address, bigNum(1234), 'description');
  //
  //   // await this.governor.castVote(1, true);   evm_mine
  //
  //
  //   await advanceNBlocks(11);
  //   // await time.advanceBlockTo(parseInt(await time.latestBlock()) + 1);;
  //
  //
  //   await this.governor.castVote(1, true);
  //   await this.governor.connect(this.alice).castVote(1, true);
  //
  //   await advanceNBlocks(21);
  //
  //
  //   await this.governor.queue(1);
  //   await network.provider.send("evm_increaseTime", [1000000]);
  //   // await advanceNBlocks(1);
  //
  //   console.log(smallNum(await this.token.balanceOf(this.carol.address)));
  //
  //   await this.governor.connect(this.alice).execute(1);
  //
  //   console.log(smallNum(await this.token.balanceOf(this.carol.address)));
  //
  //   // console.log(await this.governor.proposals(1));
  //
  //
  //   // console.log(await this.governor.getActions(1));
  //
  //
  //   // await this.governor.connect(this.alice).propose([this.carol.address], [2000], ['signatures'], [12345678], 'description');
  //
  //   // console.log('//*/*/*/*/*/*/*/*/*/*/*/*/**//**//*//*/*/');
  //   // await this.token.transfer(this.governor.address, bigNum(1234));
  // });
  //

  it("should create community by holders", async function() {
    await this.token.transfer(this.governor.address, bigNum(1234));

    const target = this.communityFactory.address;
    const value = 0;
    const signature = 'deployCommunity(address,uint256,uint256,uint256,uint256,address)';
    const data = ethers.utils.defaultAbiCoder.encode(['address','uint256','uint256','uint256','uint256','address'],
        [this.alice.address, bigNum(100), bigNum(1000), 1111, 111, zeroAddress]);
    const description = 'description';

    await this.governor.propose(target, value, signature, data, description);

    await advanceNBlocks(11);

    await this.governor.castVote(1, true);
    await this.governor.connect(this.alice).castVote(1, true);

    await advanceNBlocks(21);

    await network.provider.send("evm_increaseTime", [1000000]);

    await this.governor.connect(this.alice).execute(1);
  });

  it("should create community by signers", async function() {
    await this.token.transfer(this.governor.address, bigNum(1234));

    const target = this.communityFactory.address;
    const value = 0;
    const signature = 'deployCommunity(address,uint256,uint256,uint256,uint256,address)';
    const data = ethers.utils.defaultAbiCoder.encode(['address','uint256','uint256','uint256','uint256','address'],
        [this.alice.address, bigNum(100), bigNum(1000), 1111, 111, zeroAddress]);
    const description = 'description';

    await this.governor.proposeBySigner(target, value, signature, data, description);

    await this.governor.signProposal(1);

    await this.governor.connect(this.alice).signProposal(1);

    await network.provider.send("evm_increaseTime", [1000000]);

    await this.governor.connect(this.alice).executeBySigner(1);
  });
});
