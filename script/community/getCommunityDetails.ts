// @ts-ignore
import {ethers, config, network} from "hardhat";
import {fromEther, toEther} from "../../test/utils/helpers";

// mainnet
const communityAdminAddress = "0xd61c407c3A00dFD8C355973f7a14c55ebaFDf6F9";
const proxyAdminAddress = "0xFC641CE792c242EACcD545B7bee2028f187f61EC";
const pactAddress = "0x46c9757C5497c5B1f2eb73aE79b6B67D119B0B58";
const cUSDAddress = "0x765DE816845861e75A25fCA122bb6898B8B1282a";

// // alfajores
// const communityAdminAddress = "0x1c33D75bcE52132c7a0e220c1C338B9db7cf3f3A";
// const proxyAdminAddress = "0x79f9ca5f1A01e1768b9C24AD37FF63A0199E3Fe5";


async function main() {
    const proxyAdmin = await ethers.getContractAt(
        "ImpactProxyAdmin",
        proxyAdminAddress
    );

    const PACT = await ethers.getContractAt(
        "PACTToken",
        pactAddress
    );

    const cUSD = await ethers.getContractAt(
        "TokenMock",
        cUSDAddress
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

    let richCommunities = 0;
    let richCommunitiesWithClaim = 0;
    let differentMinTrancheCommunities = 0;


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
        // console.log('version: ', version);
        //
        // if (version >= 3) {
        //     console.log('implementation: ', await communityAdmin.getCommunityProxyImplementation(communityAddress));
        // }

        const balance = await cUSD.balanceOf(communityAddress);
        console.log('balance: ', fromEther(balance));

        const minTranche = await community.minTranche();
        if (!(minTranche.eq(toEther(100)))) {
            differentMinTrancheCommunities++;
            console.log('--------------------------------------------------------------------------------------------------');
            console.log('--------------------------------------------------------------------------------------------------');
            console.log('--------------------------------------------------------------------------------------------------');
            console.log('--------------------------------------------------------------------------------------------------');
            console.log('--------------------------------------------------------------------------------------------------');
            console.log('minTranche: ', minTranche);
        }

        if(balance.gte(toEther(10))) {
            richCommunities++;
            const toClaim = await communityAdmin.calculateCommunityTrancheAmount(communityAddress);

            const blockNumber = 15925695;
            const lastFundRequest = await community.lastFundRequest();
            const baseInterval = await community.baseInterval();

            console.log('blockNumber: ', blockNumber);
            console.log('lastFundRequest: ', lastFundRequest);
            console.log('baseInterval: ', baseInterval);



            if(lastFundRequest.add(baseInterval).lt(blockNumber)) {
                richCommunitiesWithClaim++;
                console.log('***********************************************************************************************');
                console.log('***********************************************************************************************');
                console.log('***********************************************************************************************');
                console.log('***********************************************************************************************');
                console.log('toClaim: ', toClaim);
            }
        }
    }

    console.log('richCommunities: ', richCommunities);
    console.log('richCommunitiesWithClaim: ', richCommunitiesWithClaim);
    console.log('differentMinTrancheCommunities: ', differentMinTrancheCommunities);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
