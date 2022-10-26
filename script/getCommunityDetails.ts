// @ts-ignore
import {ethers, config, network} from "hardhat";

// // mainnet
// const communityAdminAddress = "0xd61c407c3A00dFD8C355973f7a14c55ebaFDf6F9";
// const proxyAdminAddress = "0xFC641CE792c242EACcD545B7bee2028f187f61EC";

// alfajores
const communityAdminAddress = "0x1c33D75bcE52132c7a0e220c1C338B9db7cf3f3A";
const proxyAdminAddress = "0x79f9ca5f1A01e1768b9C24AD37FF63A0199E3Fe5";



async function main() {
    const proxyAdmin = await ethers.getContractAt(
        "ImpactProxyAdmin",
        proxyAdminAddress
    );

    console.log('--------------------------- CommunityAdmin --------------------------------');
    const communityAdmin = await ethers.getContractAt(
        "CommunityAdminImplementation",
        communityAdminAddress
    );

    const communityListLength = (await communityAdmin.communityListLength()).toNumber();

    console.log('version: ', (await communityAdmin.getVersion()).toNumber());
    console.log('communityListLength: ', communityListLength);
    console.log('communityImplementation: ', (await communityAdmin.communityImplementation()));
    console.log('communityMiddleProxy: ', (await communityAdmin.communityMiddleProxy()));


    console.log('----------------------------- Communities ----------------------------------');

    let community;
    let communityAddress;

    for(let index = 0; index < communityListLength; index++) {
        console.log(`----------------- Community #${index}--------------------`);

        communityAddress = await communityAdmin.communityListAt(index);

        community = await ethers.getContractAt(
            "CommunityImplementation",
            communityAddress
        );

        let version  =  (await community.getVersion()).toNumber();
        console.log('address: ', communityAddress);
        console.log('version: ', version);

        if (version >= 3) {
            console.log('implementation: ', await communityAdmin.getCommunityProxyImplementation(communityAddress));
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
