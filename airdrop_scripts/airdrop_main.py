import csv
import json
import os
import multiprocessing as mp

import sys

from airdrop_scripts.export_recipients import (
    get_impact_market_managers,
    get_moola_info,
    get_ubeswap_users,
    get_moola_users,
    get_impact_market_info,
    process_ube_token, process_moo_token, get_ubeswap_info, process_cUSD_token, process_celo_token, get_impact_market_beneficiaries)
from airdrop_scripts.events_helpers import get_imarket_communities
from airdrop_scripts.util import get_block_steps, get_start_block, get_target_block, set_envvars, initConnection, to_base_18
from airdrop_scripts.web3_instance import get_web3

mp_pool = mp.Pool(mp.cpu_count()-2)


def main(config_file_path):
    config_file_path = os.path.expanduser(config_file_path)
    assert os.path.exists(config_file_path), 'config file in json format is required.'
    with open(config_file_path) as f:
        config_dict = json.load(f)

    accounts_to_ignore = set(config_dict['walletsToIgnore'])
    save_path = os.path.expanduser(config_dict.get("savePath", '~/CELO_transfers_dir'))
    if not save_path or not os.path.exists(save_path):
        save_path = os.path.expanduser('~/CELO_transfers_dir')

    network = config_dict.get("network", "http://localhost:8545")
    target_block = config_dict.get("targetBlock")
    # distributions = config_dict.get("distributions")
    # assert distributions, '`distributions` are required in the config file.'
    set_envvars(network, target_block)
    initConnection()

    web3 = get_web3()
    start_block = get_start_block()
    target_block = get_target_block()
    if target_block is not None:
        target_block = int(target_block)

    if not target_block or target_block < start_block:
        target_block = web3.eth.blockNumber

    # 0. Impact Market Communities ###########
    imarket_address, factory_address, cusd_address, celo_address, start_block = get_impact_market_info()
    print('get impact market communities (imarket-address %s): %s - %s' % (imarket_address, start_block, target_block))
    communities = get_imarket_communities(save_path, web3, imarket_address, start_block, target_block)

    celo_2_usd_rate = 6.0
    # 1. cUSD  #############
    print('get cUSD doners (token-address %s): %s - %s' % (cusd_address, start_block, target_block))
    # values in doners and holders are already converted to floats (i.e. not in base_18)
    cusd_transfers, cusd_doners_list, cusd_holders = process_cUSD_token(
        mp_pool, save_path, start_block, target_block, cusd_address, communities
    )

    # 2. CELO ##############
    print('get CELO doners (token-address %s): %s - %s' % (celo_address, start_block, target_block))
    celo_transfers, celo_doners_list, celo_holders = process_celo_token(
        mp_pool, save_path, start_block, target_block, celo_address, communities
    )
    celo_doners_list = [(a, amount*celo_2_usd_rate) for a, amount in celo_doners_list]
    celo_holders_list = [(a, amount*celo_2_usd_rate) for a, amount in celo_holders.items()]
    address_amount_tuples = []
    address_amount_tuples.extend(cusd_doners_list)
    address_amount_tuples.extend(celo_doners_list)
    aggregated_doners = {a: 0 for a, v in address_amount_tuples}
    for a, v in address_amount_tuples:
        aggregated_doners[a] += v

    sorted_doners = sorted(aggregated_doners.items(), key=lambda x: x[1])
    doners_file = os.path.join(save_path, 'doners.csv')
    with open(doners_file, 'w') as f:
        csv_writer = csv.writer(f)
        csv_writer.writerows(sorted_doners)

    # # 3. UBE token holders ############## UBE holders (around 3.3K at moment)
    # ube_address, ube_block, factory, router, factory_block = get_ubeswap_info()
    # print('get UBE token holders (token-address %s): %s - %s' % (ube_address, ube_block, target_block))
    # ube_transfers, ube_holders = process_ube_token(mp_pool, save_path, ube_block, target_block, ube_address)
    #
    # # 4. MOO token holders ############## MOO holders (around 900 at moment)
    # moo_address, moo_block, lending_contract_address, lending_block = get_moola_info()
    # print('get MOO token holders (token-address %s): %s - %s' % (moo_address, moo_block, target_block))
    # moo_transfers, moo_holders = process_moo_token(mp_pool, save_path, moo_block, target_block, moo_address)

    address_amount_tuples = []
    address_amount_tuples.extend(sorted(celo_holders_list, key=lambda x: x[1]))
    address_amount_tuples.extend(sorted(cusd_holders.items(), key=lambda x: x[1]))
    # address_amount_tuples.extend(sorted(ube_holders.items(), key=lambda x: x[1]))
    # address_amount_tuples.extend(sorted(moo_holders.items(), key=lambda x: x[1]))
    holders_file = os.path.join(save_path, 'holders.csv')
    with open(holders_file, 'w') as f:
        csv_writer = csv.writer(f)
        csv_writer.writerows(address_amount_tuples)
    sorted_holders = address_amount_tuples

    # users_file = os.path.join(save_path, 'ube-moola-users.csv')
    # # 5. UBE swap users ##############
    # print('get ubeswap users (Factory address %s): %s - %s' % (factory, factory_block, target_block))
    # ube_users = get_ubeswap_users(mp_pool, save_path, target_block, 2000)

    # # 6. MOO market users ##############
    # print('get moola users (LendingPool address %s): %s - %s' % (lending_contract_address, lending_block, target_block))
    # moola_users = get_moola_users(mp_pool, save_path, target_block, 2000)

    # addresses = [(address,) for address in set(ube_users + moola_users)]
    # with open(users_file, 'w') as f:
    #     csv_writer = csv.writer(f)
    #     csv_writer.writerows(addresses)

    # 7. Impact market community Managers ##############
    print('get imarket managers (%s communities): %s - %s' % (len(communities), start_block, target_block))
    managers = get_impact_market_managers(mp_pool, save_path, communities, start_block, target_block, chunk_size=500000)
    managers = {address.lower() for address, block in managers}
    addresses = [(address,) for address in managers]
    managers_file = os.path.join(save_path, 'managers.csv')
    with open(managers_file, 'w') as f:
        csv_writer = csv.writer(f)
        csv_writer.writerows(addresses)

    # 8. Impact market community Beneficiaries ##############
    print('get imarket beneficiaries (%s communities): %s - %s' % (len(communities), start_block, target_block))
    beneficiaries = get_impact_market_beneficiaries(mp_pool, save_path, communities, start_block, target_block, chunk_size=5000)
    # values in beneficiaries are already converted to floats (i.e. not in base_18)
    aggregated_beneficiareies = {a.lower(): 0 for a, v in beneficiaries}
    for a, v in beneficiaries:
        aggregated_beneficiareies[a.lower()] += v

    sorted_beneficiaries = sorted(aggregated_beneficiareies.items(), key=lambda x: x[1])
    beneficiaries_file = os.path.join(save_path, 'beneficiaries.csv')
    with open(beneficiaries_file, 'w') as f:
        csv_writer = csv.writer(f)
        csv_writer.writerows(sorted_beneficiaries)

    print('Completed, all info is saved in the following files: \n'
          '%s\n'
          '%s\n'
          '%s\n'
          '%s\n'
          '' % (doners_file, holders_file, managers_file, beneficiaries_file)
          )

    million = 1000000
    total_tokens = 1000 * million # 1 billion
    doners_tokens = 700 * million
    others_tokens = 300 * million
    receivers = []
    # donation_multiplier = distributions['doners']
    sorted_doners = [(a, amount) for a, amount in sorted_doners if a not in accounts_to_ignore]
    total_donations = sum([amount for _, amount in sorted_doners])
    donation_multiplier = float(doners_tokens / total_donations)
    print('donation reward multiplier == %s (total donations amount is %s) ' % (donation_multiplier, total_donations))
    receivers.extend([(address, amount * donation_multiplier) for address, amount in sorted_doners if (amount * donation_multiplier) > 0.0])

    # make receivers unique so a receiver does not receive multiple rewards
    # sorted_holders = [a for a, amount in sorted_holders]
    # sorted_beneficiaries = [a for a, amount in sorted_beneficiaries]
    # fixed_amount_recievers = set(sorted_holders + sorted_beneficiaries + managers)
    # num_holders = len(fixed_amount_recievers)
    # holder_reward = float(others_tokens / num_holders)
    # receivers.extend([(address, holder_reward) for address in fixed_amount_recievers])

    sorted_holders = [(a, amount) for a, amount in sorted_holders if a not in accounts_to_ignore]
    sorted_beneficiaries = [(a, amount) for a, amount in sorted_beneficiaries if a not in accounts_to_ignore]
    managers = [a for a in managers if a not in accounts_to_ignore]
    # Allow an address to receive multiple rewards
    num_holders = len(sorted_holders) + len(sorted_beneficiaries) + len(managers)
    holder_reward = float(others_tokens / num_holders)
    receivers.extend([(address, holder_reward) for address, amount in sorted_holders])
    receivers.extend([(address, holder_reward) for address, amount in sorted_beneficiaries])
    receivers.extend([(address, holder_reward) for address in managers])

    total_reward = 0
    aggregated_receivers = {a: 0 for a, v in receivers}
    for a, v in receivers:
        total_reward += v
        aggregated_receivers[a] += v

    sorted_receivers = sorted(aggregated_receivers.items(), key=lambda x: x[1])
    rewards_file = os.path.join(save_path, 'reward_distributions.csv')
    with open(rewards_file, 'w') as f:
        csv_writer = csv.writer(f)
        csv_writer.writerows(sorted_receivers)

    sorted_receivers_base_18 = [(a, to_base_18(amount)) for a, amount in sorted_receivers]
    rewards_file_base_18 = os.path.join(save_path, 'reward_distributions_base_18.csv')
    with open(rewards_file_base_18, 'w') as f:
        csv_writer = csv.writer(f)
        csv_writer.writerows(sorted_receivers_base_18)

    receivers_dict_base_18 = dict(sorted_receivers_base_18)
    rewards_file_base_18_json = os.path.join(save_path, 'reward_distributions_base_18.json')
    with open(rewards_file_base_18_json, 'w') as f:
        json.dump(receivers_dict_base_18, f)

    print('total reward = %s' % total_reward)
    print('smallest reward = %s' % sorted_receivers[0][1])
    print('biggest reward = %s' % sorted_receivers[-1][1])
    print('Final distributions file is saved in %s, and %s' % (rewards_file, rewards_file_base_18))


if __name__ == "__main__":
    # path = os.path.expanduser('~/CELO_transfers_dir_1')
    # if not os.path.exists(path):
    #     os.mkdir(path)
    if len(sys.argv) > 1:
        config_file_path = sys.argv[1]
    else:
        config_file_path = './config.json'

    main(config_file_path)
