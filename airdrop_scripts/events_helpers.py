import os
import json

import airdrop_scripts.util as util
from airdrop_scripts.util import to_base_18, from_base_18, initConnection, set_envvars
from airdrop_scripts.custom_web3.contract import Contract


def get_imarket_communities(_web3, imarket_address, _from, _to):
    # imarket_address = '0xe55C3eb4a04F93c3302A5d8058348157561BF5ca'
    imarket = Contract('ImpactMarket', os.getenv('IMARKET_ABI'), imarket_address)
    event_name_CommunityAdded = 'CommunityAdded'
    logs = imarket.get_event_logs(event_name_CommunityAdded, _from, _to, {}, _web3, chunk_size=500000)
    return [(l.args._communityAddress, l.blockNumber) for l in logs]


def get_all_transfers(_web3, token_address, token_name, _from, _to, filters=None, chunk_size=1000):
    filters = filters if filters is not None else {}
    erc20 = Contract(token_name, os.getenv('ERC20_ABI'), _web3.toChecksumAddress(token_address))
    event_name_Transfer = 'Transfer'
    logs = erc20.get_event_logs(
        event_name_Transfer, _from, _to,
        filters,
        _web3,
        chunk_size=chunk_size
    )
    return [(l.args["from"], l.args.to, l.args.value, l.blockNumber) for l in logs]


def extract_transfers_and_save_to_file(args):
    filename, token_address, token_name, _from, _to, filters, chunk_size = args
    set_envvars()
    web3 = initConnection()
    print('start get transfers: _from %s, _to %s ' % (_from, _to))
    transfers = get_all_transfers(web3, token_address, token_name, _from, _to, filters, chunk_size)
    print('done get transfers: _from %s, _to %s ' % (_from, _to))
    with open(filename, 'w') as outfile:
        json.dump(transfers, outfile)

    return transfers


def get_community_event_logs(
        event_name, community_address, web3, abi_path,
        from_block, to_block, filters, chunk_size=50000):
    comm_contract = Contract('Community', abi_path, web3.toChecksumAddress(community_address))
    logs = comm_contract.get_event_logs(
        event_name, from_block, to_block,
        filters,
        web3,
        chunk_size=chunk_size
    )
    return logs


def get_event_logs(args):
    (
        i, filename, contract_address, contract_name,
        abi_path_envvar, event_name, args_names, from_block,
        to_block, chunk_size, verbose
    ) = args
    set_envvars()
    web3 = initConnection()
    abi_path = os.getenv(abi_path_envvar)
    pair_contract = Contract(contract_name, abi_path, web3.toChecksumAddress(contract_address))
    print('%s (%s): get %s logs from block %s to block %s' % (contract_name, i, event_name, from_block, to_block))
    try:
        logs = pair_contract.get_event_logs(
            event_name,
            from_block,
            to_block,
            {},
            web3,
            chunk_size=chunk_size,
            verbose=verbose
        )
    except Exception as e:
        print('Error processing event: %s.%s. \n error=%s'% (contract_name, event_name, e))
        return

    print('done processing %s (%s) %s events, got %s logs' % (contract_name, i, event_name, len(logs)))
    if len(args_names) == 1:
        values = [l.args[args_names[0]] for l in logs]
    else:
        values = []
        for l in logs:
            values.append([l.args[a] for a in args_names])

    with open(filename, 'w') as outfile:
        json.dump(values, outfile)


# def get_community_transfers(_web3, token_address, token_name, _from, _to, filters=None, chunk_size=500000, sender='doner'):
#     erc20 = Contract(token_name, os.getenv('ERC20_ABI'), _web3.toChecksumAddress(token_address))
#     event_name_Transfer = 'Transfer'
#     logs = erc20.get_event_logs(
#         event_name_Transfer, _from, _to,
#         filters or {},
#         _web3,
#         chunk_size=chunk_size
#     )
#     if sender == 'doner':
#         return [(l.args['from'], l.args.value) for l in logs]
#     elif sender == 'community':
#         return [(l.args.to, l.args.value) for l in logs]
#
#     return [(l.args['from'], l.args.to, l.args.value) for l in logs]


# def process_files(numbers, path=None):
#     if path is None:
#         path = '/home/ssallam/CELO_transfers_dir'
#     _fn = os.path.join(path, 'CELO_transfers%s.txt')
#     all_transfers = []
#     total_count = 0
#     for n in numbers:
#         fn = _fn % n
#         with open(fn) as f:
#             c = f.read()
#             c_q = c.replace("'", '"')
#             c_q = c_q.replace("(", '[')
#             c_q = c_q.replace(")", ']')
#             transfers_list = json.loads(c_q)
#             print('num transfers in file (%s): %s' % (n, len(transfers_list)))
#             all_transfers.extend(transfers_list)
#             total_count += len(transfers_list)
#
#     outfname = '/home/ssallam/CELO_transfers_dir/transfers.json'
#     with open(outfname, 'w') as outf:
#         json.dump(all_transfers, outf)
#
#     # print('num all transfers: %s' % len(transfers_list))
#     assert len(all_transfers) == total_count, 'count mismatch: len(all)=%s, count=%s' % (len(all_transfers), total_count)
#     return all_transfers


def extract_community_doners(transfers, communities):
    doner_value_list = []
    comms_set = set(communities)
    for _from, _to, value, block in transfers:
        if _to in comms_set:
            doner_value_list.append((_from, util.from_base_18(value)))

    return doner_value_list


def extract_token_holders(transfers, min_amount=1.0):
    balances = calculate_balances(transfers)
    _min_amount = to_base_18(min_amount)
    balances = {a: from_base_18(value) for a, value in balances.items() if value >= _min_amount}
    return balances


def calculate_balances(transfers):
    _from = [t[0].lower() for t in transfers]
    _to = [t[1].lower() for t in transfers]
    _value = [t[2] for t in transfers]

    a_to_value = {a: 0 for a in _from}
    a_to_value.update({a: 0 for a in _to})

    for i, acc_f in enumerate(_from):
        a_to_value[acc_f] -= int(_value[i])
        a_to_value[_to[i]] += int(_value[i])

    return a_to_value


# def _get_pair_swap_logs(args):
#     i, filename, pair_address, from_block, to_block, chunk_size = args
#     set_envvars()
#     web3 = initConnection()
#     abi_path = os.getenv('UBE_PAIR_ABI')
#     pair_name = 'Pair'
#     event_name_Swap = 'Swap'
#     arg_name = 'sender' # a user ethereum address
#     pair_contract = Contract(pair_name, abi_path, web3.toChecksumAddress(pair_address))
#     print('Pair %s: get swap logs from block %s to block %s' % (i, from_block, to_block))
#     logs = pair_contract.get_event_logs(
#         event_name_Swap,
#         from_block,
#         to_block,
#         {},
#         web3,
#         chunk_size=chunk_size,
#         verbose=False
#     )
#     print('done processing Pair %s Swap events, got %s logs' % (i, len(logs)))
#     users = [l.args[arg_name] for l in logs]
#     with open(filename, 'w') as outfile:
#         json.dump(users, outfile)
