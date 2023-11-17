import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {deployments, ethers} from "hardhat";
import {createProposal, toEther} from "../../../test/utils/helpers";
import * as ethersTypes from "ethers";
import {getExchangePathProd} from "../../../test/utils/uniswap";

const {deploy} = deployments;
let deployer: SignerWithAddress;

// // mainnet
// const governanceDelegatorAddress = "0x8f8BB984e652Cb8D0aa7C9D6712Ec2020EB1BAb4";
// const donationMinerProxyAddress = "0x1C51657af2ceBA3D5492bA0c5A17E562F7ba6593";
// const proxyAdminAddress = "0xFC641CE792c242EACcD545B7bee2028f187f61EC";
// const recurringCronAddress = "";


// alfajores
const governanceDelegatorAddress = "0x5c27e2600a3eDEF53DE0Ec32F01efCF145419eDF";
const donationMinerProxyAddress = "0x09Cdc8f50994F63103bc165B139631A6ad18EF49";
const proxyAdminAddress = "0x79f9ca5f1A01e1768b9C24AD37FF63A0199E3Fe5";
const recurringCronAddress = "0x8903B83B6e1B1379f41a9cc82080Be10E1c8E6d3";

let newDonationMinerImplementationAddress: string;


const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    // const { deployments, ethers } = hre;

    const accounts: SignerWithAddress[] = await ethers.getSigners();
    deployer = accounts[0];

    await deployNewDonationMinerImplementation();
    await createCallProposal();
};

async function deployNewDonationMinerImplementation() {
    console.log("Deploying new DonationMinerImplementation");
    newDonationMinerImplementationAddress = (
        await deploy('DonationMinerImplementation', {
            from: deployer.address,
            args: [],
            log: true,
        })
    ).address;
}

async function createCallProposal() {
    console.log("Creating new proposal");

    await createProposal(
        governanceDelegatorAddress,
        deployer,
        [
            proxyAdminAddress,
            donationMinerProxyAddress
        ],
        [0, 0],
        [
            "upgrade(address,address)",
            "updateRecurringCronAddress(address)"
        ],
        [
            ["address", "address"],
            ["address"]
        ],
        [
            [donationMinerProxyAddress, newDonationMinerImplementationAddress],
            [recurringCronAddress],
        ],
        'Upgrade DonationMiner and set recurringCronAddress'
    );
}

export default func;
func.tags = ["DonationMiner.upgrade+DonationMiner.updateRecurringCronAddress"];
