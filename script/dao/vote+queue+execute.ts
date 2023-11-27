// @ts-ignore
import {ethers, config, deployments} from "hardhat";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {getBlockTimestamp, getCurrentBlockTimestamp, getFutureBlockTimestamp} from "../../test/utils/TimeTravel";

// mainnet
const governanceDelegatorAddress = "0x8f8BB984e652Cb8D0aa7C9D6712Ec2020EB1BAb4";

// alfajores
// const governanceDelegatorAddress = "0x5c27e2600a3eDEF53DE0Ec32F01efCF145419eDF";


enum ProposalState {
  Pending,
  Active,
  Canceled,
  Defeated,
  Succeeded,
  Queued,
  Expired,
  Executed
}


async function main() {
  const accounts: SignerWithAddress[] = await ethers.getSigners();
  const voter = accounts[0];

  const governanceDelegator = await ethers.getContractAt(
    "PACTDelegate",
    governanceDelegatorAddress
  );


  let proposalCount = await governanceDelegator.proposalCount();

  console.log('proposalCount: ', proposalCount);


  for(let proposalId = proposalCount - 4; proposalId < proposalCount; proposalId++) {
    const proposal = await governanceDelegator.proposals(proposalId);
    const startBlockTimestamp = await getBlockTimestamp(proposal.startBlock.toString());
    const endBlockTimestamp = await getFutureBlockTimestamp(proposal.endBlock);

    console.log('******************************************************************');
    console.log('proposalId:           ',  proposalId);
    console.log('proposal.id:           ', proposal.id);
    console.log('proposal.proposer:     ', proposal.proposer);
    console.log('proposal.forVotes:     ', proposal.forVotes);
    console.log('proposal.againstVotes: ', proposal.againstVotes);
    console.log('proposal.abstainVotes: ', proposal.abstainVotes);
    console.log('proposal.canceled:     ', proposal.canceled);
    console.log('proposal.executed:     ', proposal.executed);
    console.log('proposal.eta:          ', proposal.eta);
    console.log('proposal.startBlock:   ', new Date(startBlockTimestamp * 1000));
    console.log('proposal.endBlock:     ', new Date(endBlockTimestamp * 1000));
    console.log('******************************************************************');

    const proposalState = await governanceDelegator.state(proposalId);
    console.log('proposalState: ', ProposalState[proposalState], `(${proposalState})`);
  }



  // await governanceDelegator.connect(voter).castVote(204, 1);
  // await governanceDelegator.connect(voter).queue(204);
  // await governanceDelegator.connect(voter).execute(204);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
