import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {deployments, ethers} from "hardhat";
import {createProposal, toEther} from "../../../test/utils/helpers";

const {deploy} = deployments;
let deployer: SignerWithAddress;

// mainnet
const governanceDelegatorAddress = "0x8f8BB984e652Cb8D0aa7C9D6712Ec2020EB1BAb4";
const donationMinerProxyAddress = "0x1C51657af2ceBA3D5492bA0c5A17E562F7ba6593";


// alfajores
// const governanceDelegatorAddress = "0x5c27e2600a3eDEF53DE0Ec32F01efCF145419eDF";
// const donationMinerProxyAddress = "0x09Cdc8f50994F63103bc165B139631A6ad18EF49";


const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    // const { deployments, ethers } = hre;

    const accounts: SignerWithAddress[] = await ethers.getSigners();
    deployer = accounts[0];

    await createCallProposal();
};


async function createCallProposal() {
    console.log("Creating new proposal");

    await createProposal(
        governanceDelegatorAddress,
        deployer,
        [
            donationMinerProxyAddress
        ],
        [0],
        [
            "updateStakingDonationRatio(uint256)"
        ],
        [
            ["uint256"]
        ],
        [
            [100000],
        ],
        'Upgrade DonationMiner.stakingDonationRatio'
    );
}

export default func;
func.tags = ["DonationMiner.updateStakingDonationRatio"];
