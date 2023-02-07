// @ts-ignore
import chai from "chai";
// @ts-ignore
import chaiAsPromised from "chai-as-promised";
// @ts-ignore
import {deployments, ethers, getNamedAccounts} from "hardhat";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import * as ethersTypes from "ethers";
import {toEther} from "../utils/helpers";
import {
    createPool,
    getExchangePath, uniswapNFTPositionManagerAddress,
    uniswapQuoterAddress,
    uniswapRouterAddress,
} from "../utils/uniswap";
import qunit = Mocha.interfaces.qunit;

chai.use(chaiAsPromised);
const expect = chai.expect;

describe("Treasury", () => {
    //these tests work only on a celo mainnet fork network
    let owner: SignerWithAddress;
    let user1: SignerWithAddress;
    let user2: SignerWithAddress;
    let user3: SignerWithAddress;

    let ImpactProxyAdmin: ethersTypes.Contract;
    let PACT: ethersTypes.Contract;
    let Treasury: ethersTypes.Contract;
    let TreasuryImplementation: ethersTypes.Contract;
    let CommunityAdmin: ethersTypes.Contract;
    let cUSD: ethersTypes.Contract;
    let mUSD: ethersTypes.Contract;
    let cTKN: ethersTypes.Contract;

    const FAKE_ADDRESS = "0x000000000000000000000000000000000000dEaD";

    const deploy = deployments.createFixture(async () => {
        await deployments.fixture("Test", {fallbackToGlobal: false});

        [owner, user1, user2, user3] = await ethers.getSigners();

        TreasuryImplementation = await ethers.getContractAt(
            "TreasuryImplementation",
            (
                await deployments.get("TreasuryImplementation")
            ).address
        );

        Treasury = await ethers.getContractAt(
            "TreasuryImplementation",
            (
                await deployments.get("TreasuryProxy")
            ).address
        );

        CommunityAdmin = await ethers.getContractAt(
            "CommunityAdminImplementation",
            (
                await deployments.get("CommunityAdminProxy")
            ).address
        );

        ImpactProxyAdmin = await ethers.getContractAt(
            "ImpactProxyAdmin",
            (
                await deployments.get("ImpactProxyAdmin")
            ).address
        );

        PACT = await ethers.getContractAt(
            "PACTToken",
            (
                await deployments.get("PACTToken")
            ).address
        );

        cUSD = await ethers.getContractAt(
            "TokenMock",
            (
                await deployments.get("TokenMock")
            ).address
        );

        const tokenFactory = await ethers.getContractFactory("TokenMock");

        mUSD = await tokenFactory.deploy("mUSD", "mUSD");
        cTKN = await tokenFactory.deploy("cTKN", "cTKN");
    });


    describe("Treasury - Basic", () => {
        before(async function () {
        });

        beforeEach(async () => {
            await deploy();
        });

        it("Should have correct values", async function () {
            expect(await Treasury.communityAdmin()).to.be.equal(
                CommunityAdmin.address
            );
            expect(await Treasury.owner()).to.be.equal(owner.address);
            expect(await Treasury.getVersion()).to.be.equal(2);
            expect(await Treasury.tokenListLength()).to.be.equal(1);
            expect(await Treasury.tokenListAt(0)).to.be.equal(cUSD.address);
        });

        it("Should transfer founds to address is owner", async function () {
            const initialBalance = await cUSD.balanceOf(owner.address);
            expect(await cUSD.balanceOf(Treasury.address)).to.be.equal(0);
            await cUSD.mint(Treasury.address, toEther("100"));
            expect(await cUSD.balanceOf(Treasury.address)).to.be.equal(
                toEther("100")
            );
            await Treasury.transfer(cUSD.address, owner.address, toEther("100"));
            expect(await cUSD.balanceOf(Treasury.address)).to.be.equal(0);
            expect(await cUSD.balanceOf(owner.address)).to.be.equal(
                initialBalance.add(toEther("100"))
            );
        });

        it("Should update communityAdmin if owner", async function () {
            await Treasury.updateCommunityAdmin(user1.address);
            expect(await Treasury.communityAdmin()).to.be.equal(user1.address);
        });

        it("Should transfer founds to address is communityAdmin", async function () {
            const initialBalance = await cUSD.balanceOf(owner.address);
            await Treasury.updateCommunityAdmin(user1.address);

            expect(await cUSD.balanceOf(Treasury.address)).to.be.equal(0);
            await cUSD.mint(Treasury.address, toEther("100"));
            expect(await cUSD.balanceOf(Treasury.address)).to.be.equal(
                toEther("100")
            );
            await Treasury.connect(user1).transfer(
                cUSD.address,
                owner.address,
                toEther("100")
            );
            expect(await cUSD.balanceOf(Treasury.address)).to.be.equal(0);
            expect(await cUSD.balanceOf(owner.address)).to.be.equal(
                initialBalance.add(toEther("100"))
            );
        });

        it("Should update implementation if owner", async function () {
            const NewTreasuryImplementationFactory =
                await ethers.getContractFactory("TreasuryImplementation");
            const NewTreasuryImplementation =
                await NewTreasuryImplementationFactory.deploy();

            await expect(
                ImpactProxyAdmin.upgrade(
                    Treasury.address,
                    NewTreasuryImplementation.address
                )
            ).to.be.fulfilled;
            expect(
                await ImpactProxyAdmin.getProxyImplementation(Treasury.address)
            ).to.be.equal(NewTreasuryImplementation.address);
        });

        it("Should not update implementation if not owner", async function () {
            const NewTreasuryImplementationFactory =
                await ethers.getContractFactory("TreasuryImplementation");
            const NewTreasuryImplementation =
                await NewTreasuryImplementationFactory.deploy();

            await expect(
                ImpactProxyAdmin.connect(user1).upgrade(
                    Treasury.address,
                    NewTreasuryImplementation.address
                )
            ).to.be.rejectedWith("Ownable: caller is not the owner");
            expect(
                await ImpactProxyAdmin.getProxyImplementation(Treasury.address)
            ).to.be.equal(TreasuryImplementation.address);
        });

        it("Should not update UniswapRouter if not owner", async function () {
            await expect(
                Treasury.connect(user1).updateUniswapRouter(FAKE_ADDRESS)
            ).to.be.rejectedWith("Treasury: caller is not the owner nor ImpactMarketCouncil");
            expect(await Treasury.uniswapRouter()).to.be.equal(
                uniswapRouterAddress
            );
        });

        it("Should update UniswapRouter if owner", async function () {
            await expect(Treasury.updateUniswapRouter(FAKE_ADDRESS))
                .to.emit(Treasury, "UniswapRouterUpdated")
                .withArgs(uniswapRouterAddress, FAKE_ADDRESS);
            expect(await Treasury.uniswapRouter()).to.be.equal(FAKE_ADDRESS);
        });

        it("Should not update UniswapQuoter if not owner", async function () {
            await expect(
                Treasury.connect(user1).updateUniswapRouter(FAKE_ADDRESS)
            ).to.be.rejectedWith("Treasury: caller is not the owner nor ImpactMarketCouncil");
            expect(await Treasury.uniswapQuoter()).to.be.equal(
                uniswapQuoterAddress
            );
        });

        it("Should update uniswapQuoter if owner", async function () {
            await expect(Treasury.updateUniswapQuoter(FAKE_ADDRESS))
                .to.emit(Treasury, "UniswapQuoterUpdated")
                .withArgs(uniswapQuoterAddress, FAKE_ADDRESS);
            expect(await Treasury.uniswapQuoter()).to.be.equal(FAKE_ADDRESS);
        });

        it("Should not update uniswapNFTPositionManager if not owner", async function () {
            await expect(
                Treasury.connect(user1).updateUniswapNFTPositionManager(FAKE_ADDRESS)
            ).to.be.rejectedWith("Treasury: caller is not the owner nor ImpactMarketCouncil");
            expect(await Treasury.uniswapNFTPositionManager()).to.be.equal(
                uniswapNFTPositionManagerAddress
            );
        });

        it("Should update uniswapNFTPositionManager if owner", async function () {
            await expect(Treasury.updateUniswapNFTPositionManager(FAKE_ADDRESS))
                .to.emit(Treasury, "UniswapNFTPositionManagerUpdated")
                .withArgs(uniswapNFTPositionManagerAddress, FAKE_ADDRESS);
            expect(await Treasury.uniswapNFTPositionManager()).to.be.equal(FAKE_ADDRESS);
        });

        it("Should not update lpPercentage if not owner", async function () {
            await expect(
                Treasury.connect(user1).updateLpPercentage(toEther(10))
            ).to.be.rejectedWith("Treasury: caller is not the owner nor ImpactMarketCouncil");
            expect(await Treasury.lpPercentage()).to.be.equal(0);
        });

        it("Should update lpPercentage if owner", async function () {
            await expect(Treasury.updateLpPercentage(toEther(10)))
                .to.emit(Treasury, "LpPercentageUpdated")
                .withArgs(0, toEther(10));
            expect(await Treasury.lpPercentage()).to.be.equal(toEther(10));
        });
    });


    describe("Treasury - new tokens", () => {
        before(async function () {});

        beforeEach(async () => {
            await deploy();

            await cUSD.mint(owner.address, toEther(1000000000));
            await mUSD.mint(owner.address, toEther(1000000000));
            await cTKN.mint(owner.address, toEther(1000000000));

            await createPool(owner, cUSD, mUSD, toEther(1000000), toEther(1000000));
            await createPool(owner, mUSD, cTKN, toEther(1000000), toEther(500000));
        });

        it("Should set token if owner", async function () {
            const exchangePath = getExchangePath(mUSD, cUSD);

            await expect(Treasury.setToken(mUSD.address, toEther(1), exchangePath, 123))
                .to.be.to.emit(Treasury, "TokenSet")
                .withArgs(mUSD.address, 0, '0x', 0, toEther(1), exchangePath, 123);

            const token = await Treasury.tokens(mUSD.address);
            expect(token.rate).to.be.equal(toEther(1));
            expect(token.exchangePath).to.be.equal(exchangePath);
            expect(token.uniswapNFTPositionManagerId).to.be.equal(123);
            expect(await Treasury.tokenListLength()).to.be.equal(2);
            expect(await Treasury.tokenListAt(0)).to.be.equal(cUSD.address);
            expect(await Treasury.tokenListAt(1)).to.be.equal(mUSD.address);
        });

        it("Should not set token if not owner", async function () {
            await expect(
                Treasury.connect(user1).setToken(mUSD.address, 500, '0x', 123)
            ).to.be.rejectedWith("Treasury: caller is not the owner nor ImpactMarketCouncil");

            const token = await Treasury.tokens(mUSD.address);

            expect(token.rate).to.be.equal(0);
            expect(token.exchangePath).to.be.equal("0x");
            expect(await Treasury.tokenListLength()).to.be.equal(1);
        });

        it("Should setToken without exchangePath", async function () {
            await expect(Treasury.setToken(mUSD.address, toEther(0.5), "0x", 123)).to.be
                .fulfilled;

            const token = await Treasury.tokens(mUSD.address);
            expect(token.rate).to.be.equal(toEther(0.5));
            expect(token.exchangePath).to.be.equal("0x");
            expect(token.uniswapNFTPositionManagerId).to.be.equal(123);
            expect(await Treasury.tokenListLength()).to.be.equal(2);
        });

        it("Should not set token without rate", async function () {
            const exchangePath = getExchangePath(mUSD, cUSD);

            await expect(
                Treasury.setToken(mUSD.address, 0, exchangePath, 123)
            ).to.be.rejectedWith("Treasury::setToken: Invalid rate");
        });

        it("Should not set token with invalid exchangePath #1", async function () {
            const exchangePath = getExchangePath(cTKN, cUSD);
            await expect(
                Treasury.setToken(mUSD.address, toEther(1), exchangePath, 123)
            ).to.be.rejectedWith("Transaction reverted without a reason string");

            const token = await Treasury.tokens(mUSD.address);
            expect(token.rate).to.be.equal(0);
            expect(token.exchangePath).to.be.equal("0x");
            expect(await Treasury.tokenListLength()).to.be.equal(1);
        });

        it("Should not remove token if not owner", async function () {
            await Treasury.setToken(mUSD.address, 500, "0x", 123);

            await expect(
                Treasury.connect(user1).removeToken(mUSD.address)
            ).to.be.rejectedWith("Treasury: caller is not the owner nor ImpactMarketCouncil");
        });

        it("Should revert when removing an invalid token", async function () {
            await expect(Treasury.removeToken(mUSD.address)).to.be.rejectedWith(
                "Treasury::removeToken: this is not a token"
            );
        });

        it("Should remove token if owner", async function () {
            await Treasury.setToken(mUSD.address, toEther(0.5), "0x", 123);

            expect(await Treasury.tokenListLength()).to.be.equal(2);
            await expect(Treasury.removeToken(mUSD.address))
                .to.emit(Treasury, "TokenRemoved")
                .withArgs(mUSD.address);

            const token = await Treasury.tokens(mUSD.address);
            expect(token.rate).to.be.equal(0);
            expect(token.exchangePath).to.be.equal("0x");
            expect(token.uniswapNFTPositionManagerId).to.be.equal(0);
            expect(await Treasury.tokenListLength()).to.be.equal(1);
        });

        it("Should getConvertedAmount, rate = 1 #1", async function () {
            const exchangePath = getExchangePath(mUSD, cUSD);
            await Treasury.setToken(mUSD.address, toEther(1), exchangePath, 123);

            expect(
                await Treasury.callStatic.getConvertedAmount(
                    mUSD.address,
                    toEther(1)
                )
            ).to.be.equal(toEther("0.989999019900970298"));
        });

        it("Should getConvertedAmount, rate = 1 #2", async function () {
            const exchangePath = getExchangePath(mUSD, cUSD);
            await Treasury.setToken(mUSD.address, toEther(1), exchangePath, 123);

            expect(
                await Treasury.callStatic.getConvertedAmount(
                    mUSD.address,
                    toEther(100)
                )
            ).to.be.equal(toEther("98.990199970202949907"));
        });

        it("Should getConvertedAmount, rate != 1 #1", async function () {
            const exchangePath = getExchangePath(mUSD, cUSD);
            await Treasury.setToken(mUSD.address, toEther(0.5), exchangePath, 123);

            expect(
                await Treasury.callStatic.getConvertedAmount(
                    mUSD.address,
                    toEther(1)
                )
            ).to.be.equal(toEther("0.989999019900970298").div(2));
        });

        it("Should getConvertedAmount, rate != 1 #2", async function () {
            const exchangePath = getExchangePath(mUSD, cUSD);
            await Treasury.setToken(mUSD.address, toEther(2), exchangePath, 123);

            expect(
                await Treasury.callStatic.getConvertedAmount(
                    mUSD.address,
                    toEther(1)
                )
            ).to.be.equal(toEther("0.989999019900970298").mul(2));
        });

        it("Should not getConvertedAmount if invalid token", async function () {
            await expect(
                Treasury.callStatic.getConvertedAmount(mUSD.address, toEther(1))
            ).to.be.rejectedWith(
                "Treasury::getConvertedAmount: this is not a valid token"
            );
        });

        it("Should not convertAmount if not owner", async function () {
            const exchangePath = getExchangePath(mUSD, cUSD);
            await Treasury.setToken(mUSD.address, toEther(2), exchangePath, 111);

            await expect(
                Treasury.connect(user1).convertAmount(
                    mUSD.address,
                    toEther(1),
                    123,
                    "0x"
                )
            ).to.be.rejectedWith("Treasury: caller is not the owner nor ImpactMarketCouncil");
        });

        it("Should not convertAmount if invalid token", async function () {
            await expect(
                Treasury.convertAmount(mUSD.address, toEther(1), 123, "0x")
            ).to.be.rejectedWith(
                "Treasury::convertAmount: this is not a valid token"
            );
        });

        it("Should convertAmount #1", async function () {
            const exchangePath = getExchangePath(mUSD, cUSD);
            await Treasury.setToken(mUSD.address, toEther(0.9), exchangePath, 0);
            await mUSD.mint(Treasury.address, toEther(1));

            await expect(Treasury.convertAmount(mUSD.address, toEther(1), 0, "0x"))
                .to.emit(Treasury, "AmountConverted")
                .withArgs(
                    mUSD.address,
                    toEther(1),
                    0,
                    exchangePath,
                    toEther("0.989999019900970298")
                );

            expect(await mUSD.balanceOf(Treasury.address)).to.be.equal(toEther(0));
            expect(await cUSD.balanceOf(Treasury.address)).to.be.equal(
                toEther("0.989999019900970298")
            );
        });

        it("Should convertAmount #2", async function () {
            const exchangePath = getExchangePath(mUSD, cUSD);
            await Treasury.setToken(mUSD.address, toEther(0.9), exchangePath, 0);
            await mUSD.mint(Treasury.address, toEther(1000));

            await expect(
                Treasury.convertAmount(mUSD.address, toEther(1000), 0, "0x")
            )
                .to.emit(Treasury, "AmountConverted")
                .withArgs(
                    mUSD.address,
                    toEther(1000),
                    0,
                    exchangePath,
                    toEther("989.020869339354039500")
                );

            expect(await mUSD.balanceOf(Treasury.address)).to.be.equal(toEther(0));
            expect(await cUSD.balanceOf(Treasury.address)).to.be.equal(
                toEther("989.020869339354039500")
            );
        });

        it("Should convertAmount #3", async function () {
            const exchangePath = getExchangePath(mUSD, cUSD);
            await Treasury.setToken(mUSD.address, toEther(0.9), exchangePath, 0);
            await mUSD.mint(Treasury.address, toEther(500000));

            await expect(
                Treasury.convertAmount(mUSD.address, toEther(500000), 0, "0x")
            )
                .to.emit(Treasury, "AmountConverted")
                .withArgs(
                    mUSD.address,
                    toEther(500000),
                    0,
                    exchangePath,
                    toEther("331103.678929765886293590")
                );

            expect(await mUSD.balanceOf(Treasury.address)).to.be.equal(toEther(0));
            expect(await cUSD.balanceOf(Treasury.address)).to.be.equal(
                toEther("331103.678929765886293590")
            );
        });

        it("Should convertAmount #4", async function () {
            const exchangePath = getExchangePath(mUSD, cUSD);
            await Treasury.setToken(mUSD.address, toEther(0.9), exchangePath, 0);
            await mUSD.mint(Treasury.address, toEther(1000000));

            await expect(
                Treasury.convertAmount(mUSD.address, toEther(1000000), 0, "0x")
            )
                .to.emit(Treasury, "AmountConverted")
                .withArgs(
                    mUSD.address,
                    toEther(1000000),
                    0,
                    exchangePath,
                    toEther("497487.437185929648254671")
                );

            expect(await mUSD.balanceOf(Treasury.address)).to.be.equal(toEther(0));
            expect(await cUSD.balanceOf(Treasury.address)).to.be.equal(
                toEther("497487.437185929648254671")
            );
        });

        it("Should convertAmount #5", async function () {
            const exchangePath = getExchangePath(mUSD, cUSD);
            await Treasury.setToken(mUSD.address, toEther(0.9), exchangePath, 0);
            await mUSD.mint(Treasury.address, toEther(1000000));

            await expect(
                Treasury.convertAmount(mUSD.address, toEther(500000), 0, "0x")
            )
                .to.emit(Treasury, "AmountConverted")
                .withArgs(
                    mUSD.address,
                    toEther(500000),
                    0,
                    exchangePath,
                    toEther("331103.678929765886293590")
                );
            await expect(
                Treasury.convertAmount(mUSD.address, toEther(500000), 0, "0x")
            )
                .to.emit(Treasury, "AmountConverted")
                .withArgs(
                    mUSD.address,
                    toEther(500000),
                    0,
                    exchangePath,
                    toEther("166383.758256163761961081")
                );

            expect(await mUSD.balanceOf(Treasury.address)).to.be.equal(toEther(0));
            expect(await cUSD.balanceOf(Treasury.address)).to.be.equal(
                toEther("497487.437185929648254671")
            );
        });

        it("Should convertAmount #6", async function () {
            const exchangePath1 = getExchangePath(mUSD, cUSD);
            const exchangePath2 = getExchangePath(cTKN, mUSD, cUSD);

            await Treasury.setToken(mUSD.address, toEther(0.9), exchangePath1, 0);
            await Treasury.setToken(cTKN.address, toEther(0.5), exchangePath2, 0);

            await cTKN.mint(Treasury.address, toEther(100));

            // 48.992898509103758825
            await expect(
                Treasury.convertAmount(cTKN.address, toEther(100), 0, "0x")
            )
                .to.emit(Treasury, "AmountConverted")
                .withArgs(
                    cTKN.address,
                    toEther(100),
                    0,
                    exchangePath2,
                    toEther("195.942794620063802459")
                );

            expect(await cTKN.balanceOf(Treasury.address)).to.be.equal(toEther(0));
            expect(await cUSD.balanceOf(Treasury.address)).to.be.equal(
                toEther("195.942794620063802459")
            );
        });

        it("Should convertAmount with custom path", async function () {
            const exchangePath1 = getExchangePath(mUSD, cUSD);
            const exchangePath2 = getExchangePath(cTKN, mUSD, cUSD);
            const exchangePath3 = getExchangePath(cTKN, cUSD);

            await Treasury.setToken(mUSD.address, toEther(0.9), exchangePath1, 0);
            await Treasury.setToken(cTKN.address, toEther(0.5), exchangePath2, 0);

            await createPool(owner, cUSD, cTKN, toEther(1000000), toEther(500000));

            await cTKN.mint(Treasury.address, toEther(100));

            await expect(
                Treasury.convertAmount(cTKN.address, toEther(100), 0, exchangePath3)
            )
                .to.emit(Treasury, "AmountConverted")
                .withArgs(
                    cTKN.address,
                    toEther(100),
                    0,
                    exchangePath3,
                    toEther("197.960803760855350640")
                );

            expect(await cTKN.balanceOf(Treasury.address)).to.be.equal(toEther(0));
            expect(await cUSD.balanceOf(Treasury.address)).to.be.equal(
                toEther("197.960803760855350640")
            );
        });
    });

	describe("Treasury - Uniswap Liquidity Pool", () => {
		before(async function () {});

		beforeEach(async () => {
			await deploy();

			await cUSD.mint(owner.address, toEther(1000000000));
			await mUSD.mint(owner.address, toEther(1000000000));
			await cTKN.mint(owner.address, toEther(1000000000));

			await createPool(owner, cUSD, mUSD, toEther(1000000), toEther(1000000));
			await createPool(owner, mUSD, cTKN, toEther(1000000), toEther(500000));
		});
	});
});
