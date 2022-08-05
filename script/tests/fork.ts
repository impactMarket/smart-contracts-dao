// @ts-ignore
import { ethers, config } from "hardhat";
import { fromEther, toEther } from "../../test/utils/helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const PactArtifact = require('../../artifacts/contracts/token/PACTToken.sol/PACTToken.json');


const PactAddress = "0x46c9757C5497c5B1f2eb73aE79b6B67D119B0B58";

const user1Address = "0xa34737409091eBD0726A3Ab5863Fc7Ee9243Edab";
const user2Address = "0x19Fa2976a8D55a8D733Da471d6Dcc1A308572B72";

async function test() {
    await ethers.provider.send("hardhat_impersonateAccount", [user1Address]);
    const user1 = await ethers.provider.getSigner(user1Address);

    const accounts: SignerWithAddress[] = await ethers.getSigners();
    const deployer = accounts[0];
    console.log(fromEther(await ethers.provider.getBalance(user1Address)));
    console.log(fromEther(await ethers.provider.getBalance(deployer.address)));
    await deployer.sendTransaction({
        to: user1Address,
        value: toEther(2)
    });
    console.log(fromEther(await ethers.provider.getBalance(user1Address)));
    await user1.sendTransaction({
        to: deployer.address,
        value: toEther(1)
    });
    console.log(fromEther(await ethers.provider.getBalance(user1Address)));
}


async function main() {
    await test();
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
