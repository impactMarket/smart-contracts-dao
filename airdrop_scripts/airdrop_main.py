import csv
import json
import os
import multiprocessing as mp

from airdrop_scripts.export_recipients import (
    get_impact_market_managers,
    get_moola_info,
    get_ubeswap_users,
    get_moola_users,
    get_impact_market_info,
    process_ube_token, process_moo_token, get_ubeswap_info, process_cUSD_token, process_celo_token, get_impact_market_beneficiaries)
from airdrop_scripts.events_helpers import get_imarket_communities
from airdrop_scripts.util import get_block_steps, get_start_block, get_target_block, set_envvars, initConnection
from airdrop_scripts.web3_instance import get_web3

mp_pool = mp.Pool(mp.cpu_count()-2)


def main(save_path=None):
    set_envvars()
    initConnection()
    if not save_path or not os.path.exists(save_path):
        save_path = os.path.expanduser('~/CELO_transfers_dir')

    web3 = get_web3()
    start_block = get_start_block()
    target_block = get_target_block()
    if not target_block or target_block < start_block:
        target_block = web3.eth.blockNumber

    imarket_address, factory_address, cusd_address, celo_address, start_block = get_impact_market_info()
    print('get impact market communities (imarket-address %s): %s - %s' % (imarket_address, start_block, target_block))
    communities = get_imarket_communities(web3, imarket_address, start_block, target_block)

    # 1. cUSD  #############
    print('get cUSD doners (token-address %s): %s - %s' % (cusd_address, start_block, target_block))
    cusd_transfers, cusd_doners_list = process_cUSD_token(
        mp_pool, save_path, start_block, target_block, cusd_address, communities
    )

    # 2. CELO ##############
    print('get CELO doners (token-address %s): %s - %s' % (celo_address, start_block, target_block))
    celo_transfers, celo_doners_list, celo_holders = process_celo_token(
        mp_pool, save_path, start_block, target_block, celo_address, communities
    )

    address_amount_tuples = []
    address_amount_tuples.extend(cusd_doners_list)
    address_amount_tuples.extend(celo_doners_list)
    doners_file = os.path.join(save_path, 'doners.csv')
    with open(doners_file, 'w') as f:
        csv_writer = csv.writer(f)
        csv_writer.writerows(address_amount_tuples)

    # 3. UBE token holders ############## UBE holders (around 3.3K at moment)
    ube_address, ube_block, factory, router, factory_block = get_ubeswap_info()
    print('get UBE token holders (token-address %s): %s - %s' % (ube_address, ube_block, target_block))
    ube_transfers, ube_holders = process_ube_token(mp_pool, save_path, ube_block, target_block, ube_address)

    # 4. MOO token holders ############## MOO holders (around 900 at moment)
    moo_address, moo_block, lending_contract_address, lending_block = get_moola_info()
    print('get MOO token holders (token-address %s): %s - %s' % (moo_address, moo_block, target_block))
    moo_transfers, moo_holders = process_moo_token(mp_pool, save_path, moo_block, target_block, moo_address)

    address_amount_tuples = []
    address_amount_tuples.extend(sorted(celo_holders.items(), key=lambda x: x[1]))
    address_amount_tuples.extend(sorted(ube_holders.items(), key=lambda x: x[1]))
    address_amount_tuples.extend(sorted(moo_holders.items(), key=lambda x: x[1]))
    holders_file = os.path.join(save_path, 'holders.csv')
    with open(holders_file, 'w') as f:
        csv_writer = csv.writer(f)
        csv_writer.writerows(address_amount_tuples)

    # 5. UBE swap users ##############
    print('get ubeswap users (Factory address %s): %s - %s' % (factory, factory_block, target_block))
    ube_users = get_ubeswap_users(mp_pool, save_path, target_block, 10000)

    # 6. MOO market users ##############
    print('get moola users (LendingPool address %s): %s - %s' % (lending_contract_address, lending_block, target_block))
    moola_users = get_moola_users(mp_pool, save_path, target_block, 10000)

    addresses = [(address, ) for address in (ube_users + moola_users)]
    users_file = os.path.join(save_path, 'ube-moola-users.csv')
    with open(users_file, 'w') as f:
        csv_writer = csv.writer(f)
        csv_writer.writerows(addresses)

    # 7. Impact market community Managers ##############
    print('get imarket managers (%s communities): %s - %s' % (len(communities), start_block, target_block))
    managers = get_impact_market_managers(communities, start_block, target_block)
    addresses = [(address, ) for address in managers]
    managers_file = os.path.join(save_path, 'managers.csv')
    with open(managers_file, 'w') as f:
        csv_writer = csv.writer(f)
        csv_writer.writerows(addresses)

    # 8. Impact market community Beneficiaries ##############
    print('get imarket beneficiaries (%s communities): %s - %s' % (len(communities), start_block, target_block))
    beneficiaries = get_impact_market_beneficiaries(communities, start_block, target_block)
    beneficiaries_file = os.path.join(save_path, 'beneficiaries.csv')
    with open(beneficiaries_file, 'w') as f:
        csv_writer = csv.writer(f)
        csv_writer.writerows(beneficiaries)

    print('Completed, all info is saved in the following files: \n'
          '%s\n'
          '%s\n'
          '%s\n'
          '%s\n'
          '%s\n'
          '' % (doners_file, holders_file, users_file, managers_file, beneficiaries_file)
          )


if __name__ == "__main__":
    path = os.path.expanduser('~/CELO_transfers_dir_1')
    if not os.path.exists(path):
        os.mkdir(path)
    main(path)

    # main()
