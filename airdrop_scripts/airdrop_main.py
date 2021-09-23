import csv
import json
import os
from multiprocessing import Process

from airdrop_scripts.export_recipients import getIMCCManagers, getIMCCBeneficiaries
from airdrop_scripts.quick_scripts import extract_transfers_and_save_to_file, get_impact_market_info, \
    get_imarket_communities, extract_community_doners, get_ubeswap_info, get_moola_info, extract_token_holders
from airdrop_scripts.util import get_block_steps, get_start_block, get_target_block
from airdrop_scripts.web3_instance import get_web3


def dispatch_get_all_transfers(save_path, from_block, to_block, token_address, token_name, chunk_size=500):
    _r = get_block_steps(from_block, to_block, 300000)
    _last = _r[0] - 1
    processes = []
    saved_files = []
    for i in range(len(_r)-1):
        _from = _last + 1
        _last = _r[i+1]
        name = os.path.join(save_path, '%s.transfers.%s-%s' % (token_name, _from, _last))
        print('getting transfers between blocks: %s, %s' % (_from, _last))
        print('saving transfers to file: %s' % name)
        saved_files.append(name)
        processes.append(
            Process(
                target=extract_transfers_and_save_to_file,
                args=(name, token_address, token_name, _from, _last, chunk_size)
            )
        )

    for p in processes:
        p.start()

    for p in processes:
        p.join()

    all_transfers = []
    for name in saved_files:
        with open(name) as f:
            transfers = json.load(f)
            all_transfers.extend(transfers)

    return all_transfers


def get_all_celo_transfers(save_path, from_block, to_block, token_address):
    return dispatch_get_all_transfers(save_path, from_block, to_block, token_address, 'cUSD')


def get_all_cusd_transfers(save_path, from_block, to_block, token_address):
    return dispatch_get_all_transfers(save_path, from_block, to_block, token_address, 'CELO')


def get_all_ube_transfers(save_path, from_block, to_block, token_address):
    return dispatch_get_all_transfers(save_path, from_block, to_block, token_address, 'UBE')


def get_all_moo_transfers(save_path, from_block, to_block, token_address):
    return dispatch_get_all_transfers(save_path, from_block, to_block, token_address, 'MOO')


def main(save_path=None):
    if not save_path or not os.path.exists(save_path):
        save_path = os.path.expanduser('~/CELO_transfers_dir')

    web3 = get_web3()
    start_block = get_start_block()
    target_block = get_target_block()
    if not target_block or target_block < start_block:
        target_block = web3.eth.blockNumber

    imarket_address, factory_address, cusd_address, celo_address, start_block = get_impact_market_info()
    communities = get_imarket_communities(web3, imarket_address, start_block, target_block)

    cusd_transfers = get_all_cusd_transfers(save_path, start_block, target_block, cusd_address)
    cusd_doners_list = extract_community_doners(cusd_transfers, communities)

    celo_transfers = get_all_celo_transfers(save_path, start_block, target_block, celo_address)
    celo_doners_list = extract_community_doners(celo_transfers, communities)
    celo_holders = extract_token_holders(celo_transfers)

    ube_address, ube_block, factory, router, factory_block = get_ubeswap_info()
    ube_transfers = get_all_ube_transfers(save_path, ube_block, target_block, ube_address)
    ube_holders = extract_token_holders(ube_transfers)
    ube_users = []
    # get ube users from the protocol contracts

    moo_address, moo_block = get_moola_info()
    moo_transfers = get_all_moo_transfers(save_path, moo_block, target_block, moo_address)
    moo_holders = extract_token_holders(moo_transfers)
    moola_users = []
    # get moola users from the protocol contracts


    managers = getIMCCManagers(communities, start_block, target_block)

    beneficiaries = getIMCCBeneficiaries(communities, start_block, target_block)

    # MOO holders (around 900 at moment)
    # UBE holders (around 3.3K at moment)
    # Maybe even all addresses that interacted with any Ube or Moola contracts (edited)

    address_amount_tuples = []
    address_amount_tuples.extend(cusd_doners_list)
    address_amount_tuples.extend(celo_doners_list)
    doners_file = os.path.join(save_path, 'doners.csv')
    with open(doners_file, 'w') as f:
        csv_writer = csv.writer(f)
        csv_writer.writerows(address_amount_tuples)

    address_amount_tuples = []
    address_amount_tuples.extend(sorted(celo_holders.items(), key=lambda x: x[1]))
    address_amount_tuples.extend(sorted(ube_holders.items(), key=lambda x: x[1]))
    address_amount_tuples.extend(sorted(moo_holders.items(), key=lambda x: x[1]))
    holders_file = os.path.join(save_path, 'holders.csv')
    with open(holders_file, 'w') as f:
        csv_writer = csv.writer(f)
        csv_writer.writerows(address_amount_tuples)

    addresses = [(address, ) for address in managers]
    managers_file = os.path.join(save_path, 'managers.csv')
    with open(managers_file, 'w') as f:
        csv_writer = csv.writer(f)
        csv_writer.writerows(addresses)


    beneficiaries_file = os.path.join(save_path, 'beneficiaries.csv')
    with open(beneficiaries_file, 'w') as f:
        csv_writer = csv.writer(f)
        csv_writer.writerows(beneficiaries)

    users_list = []
    users_list.extend(ube_users)
    users_list.extend(moola_users)
    ube_moola_users_file = os.path.join(save_path, 'ube_moola_users.csv')
    with open(ube_moola_users_file, 'w') as f:
        csv_writer = csv.writer(f)
        csv_writer.writerows(users_list)


if __name__ == "__main__":
    main()
