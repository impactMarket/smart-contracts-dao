// @ts-ignore
import { ethers, config, network } from "hardhat";
import { fromEther, toEther } from "../../test/utils/helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { advanceNSeconds, advanceTimeAndBlockNTimes, getBlockNumber } from "../../test/utils/TimeTravel";
import landing = Mocha.reporters.landing;

// const LendingPoolV2Artifact = require('@aave/protocol-v2/artifacts/contracts/protocol/lendingpool/LendingPool.sol/LendingPool.json');
const LendingPoolV2ABI = require('../../integrations/moola/abi/LendingPool.json');
const MTokenABI = require('../../integrations/moola/abi/MToken.json');
const PactArtifact = require('../../artifacts/contracts/token/PACTToken.sol/PACTToken.json');


const pactAddress = "0x46c9757C5497c5B1f2eb73aE79b6B67D119B0B58";
const cusdAddress = "0x765DE816845861e75A25fCA122bb6898B8B1282a";
const mcusdAddress = "0x918146359264C492BD6934071c6Bd31C854EDBc3";
const lendingPoolAddress = "0x970b12522ca9b4054807a2c5b736149a5be6f670";


const user1Address = "0xa34737409091eBD0726A3Ab5863Fc7Ee9243Edab";
const user2Address = "0x19Fa2976a8D55a8D733Da471d6Dcc1A308572B72";

async function checkEpoch() {
    console.log('blockNumber: ', await getBlockNumber());

    await ethers.provider.send("hardhat_impersonateAccount", [user1Address]);
    const user1 = await ethers.provider.getSigner(user1Address);

    const accounts: SignerWithAddress[] = await ethers.getSigners();
    const deployer = accounts[0];
    const user2 = accounts[1];

    await user1.sendTransaction({
        to: deployer.address,
        value: toEther(1)
    });

    // console.log(fromEther(await ethers.provider.getBalance(user1Address)));

    const cusd = await ethers.getContractAt(
        MTokenABI,
        cusdAddress
    );

    const mcusd = await ethers.getContractAt(
        MTokenABI,
        mcusdAddress
    );

    const lendingPool = await ethers.getContractAt(
        LendingPoolV2ABI,
        lendingPoolAddress
    );

    console.log('c balance: ', fromEther(await cusd.balanceOf(await user1.getAddress())));
    console.log('m balance: ', fromEther(await mcusd.balanceOf(await user1.getAddress())));
    console.log(await lendingPool.getUserConfiguration(await user1.getAddress()));
    await cusd.connect(user1).transfer(user2.address, toEther(0.1));


    await cusd.connect(user1).approve(lendingPool.address,toEther(0.2));
    await cusd.connect(user2).approve(lendingPool.address,toEther(0.1));
    await lendingPool.connect(user1).deposit(cusd.address, toEther(0.1), await user1.getAddress(), '0');
    // console.log(await lendingPool.getUserConfiguration(await user1.getAddress()));
    console.log('balance: ', fromEther(await cusd.balanceOf(await user1.getAddress())));
    console.log('m balance 1 1 : ', fromEther(await mcusd.balanceOf(await user1.getAddress())));
    console.log('m balance 1 2: ', fromEther(await mcusd.balanceOf(await user2.getAddress())));
    console.log('m scaledBalanceOf 1 1 : ', fromEther(await mcusd.scaledBalanceOf(await user1.getAddress())));
    console.log('m scaledBalanceOf 1 2: ', fromEther(await mcusd.scaledBalanceOf(await user2.getAddress())));

    // await network.provider.send("evm_increaseTime", [
    //     new Date('2022-08-10').getTime(),
    // ]);

    for (let i = 0; i <= 3; i++) {
        await cusd.connect(user1).approve(lendingPool.address,toEther(0.1));
        await advanceNSeconds(3600*24*30);
    }

    console.log('m balance 2 pre 1: ', fromEther(await mcusd.balanceOf(await user1.getAddress())));
    console.log('m balance 2 pre 2: ', fromEther(await mcusd.balanceOf(await user2.getAddress())));
    console.log('m scaledBalanceOf 2 pre 1: ', fromEther(await mcusd.scaledBalanceOf(await user1.getAddress())));
    console.log('m scaledBalanceOf 2 pre 2: ', fromEther(await mcusd.scaledBalanceOf(await user2.getAddress())));
    // await lendingPool.connect(user2).deposit(cusd.address, toEther(0.1), await user2.getAddress(), '0');
    await lendingPool.connect(user1).deposit(cusd.address, toEther(0.1), await user1.getAddress(), '0');
    console.log('m balance 2 1: ', fromEther(await mcusd.balanceOf(await user1.getAddress())));
    console.log('m balance 2 2: ', fromEther(await mcusd.balanceOf(await user2.getAddress())));
    console.log('m scaledBalanceOf 2 1: ', fromEther(await mcusd.scaledBalanceOf(await user1.getAddress())));
    console.log('m scaledBalanceOf 2 2: ', fromEther(await mcusd.scaledBalanceOf(await user2.getAddress())));


    for (let i = 0; i <= 3; i++) {
        await cusd.connect(user1).approve(lendingPool.address,toEther(0.1));
        await advanceNSeconds(3600*24*30);
    }

    console.log('m balance 3 1: ', fromEther(await mcusd.balanceOf(await user1.getAddress())));
    console.log('m balance 3 2: ', fromEther(await mcusd.balanceOf(await user2.getAddress())));
    console.log('m scaledBalanceOf 3 1: ', fromEther(await mcusd.scaledBalanceOf(await user1.getAddress())));
    console.log('m scaledBalanceOf 3 2: ', fromEther(await mcusd.scaledBalanceOf(await user2.getAddress())));
    console.log('getReserveNormalizedIncome : ', await lendingPool.getReserveNormalizedIncome(cusd.address));
    // await lendingPool.connect(user1).withdraw(cusd.address, toEther(0.1), await user1.getAddress());
    // console.log('balance: ', fromEther(await cusd.balanceOf(await user1.getAddress())));
    // console.log('mbalance 3: ', fromEther(await mcusd.balanceOf(await user1.getAddress())));




    // console.log('getreservedata: ', await lendingPool.getConfiguration(await cusd.address));
    // console.log('getreservedata: ', await lendingPool.getConfiguration(await mcusd.address));
    // console.log('getreservedata: ', await lendingPool.getConfiguration(await user1.getAddress()));
}


async function main() {
    await checkEpoch();
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
