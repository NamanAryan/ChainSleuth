"""
Generate 5 different synthetic blockchain transaction datasets for demo
Each dataset has unique characteristics and suspicious patterns
"""

import csv
import random
import uuid
from datetime import datetime, timedelta
import os

def generate_wallet_address():
    """Generate realistic blockchain-style wallet address (hex format)."""
    return "0x" + uuid.uuid4().hex[:40]

def generate_dataset(config):
    """Generate a synthetic transaction dataset based on config."""
    
    wallets = [generate_wallet_address() for _ in range(config['num_wallets'])]
    all_transactions = []
    
    # Generate laundering chains
    for chain_id in range(config['num_chains']):
        base_time = config['start_date'] + timedelta(days=random.randint(0, 364))
        transactions = generate_laundering_chain(wallets, chain_id, base_time, config)
        all_transactions.extend(transactions)
    
    # Generate normal transactions
    for _ in range(config['normal_transactions']):
        source = random.choice(wallets)
        destination = random.choice(wallets)
        while destination == source:
            destination = random.choice(wallets)
        
        amount = round(random.uniform(config['min_normal'], config['max_normal']), 2)
        timestamp = config['start_date'] + timedelta(
            seconds=random.randint(0, int((config['end_date'] - config['start_date']).total_seconds()))
        )
        
        all_transactions.append({
            'transaction_hash': f"0x{uuid.uuid4().hex[:64]}",
            'from_wallet': source,
            'to_wallet': destination,
            'amount': amount,
            'token_type': random.choice(config['tokens']),
            'timestamp': timestamp.isoformat(),
            'gas_fee': round(random.uniform(0.001, 0.1), 4),
            'transaction_type': 'normal'
        })
    
    return sorted(all_transactions, key=lambda x: x['timestamp'])

def generate_laundering_chain(wallets, chain_id, base_timestamp, config):
    """Generate a money laundering chain."""
    transactions = []
    
    available_wallets = random.sample(wallets, min(config['max_hops'] + 2, len(wallets)))
    source_wallet = available_wallets[0]
    num_intermediaries = random.randint(config['min_hops'], config['max_hops'])
    intermediaries = available_wallets[1:1+num_intermediaries]
    aggregation_wallet = available_wallets[-1]
    
    initial_amount = random.uniform(config['min_launder'], config['max_launder'])
    current_time = base_timestamp
    amount_per_intermediate = initial_amount / num_intermediaries
    
    # Fan-out phase
    for intermediate in intermediaries:
        amount_with_fee = amount_per_intermediate * random.uniform(0.95, 1.0)
        current_time += timedelta(seconds=random.randint(5, 300))
        
        transactions.append({
            'transaction_hash': f"0x{uuid.uuid4().hex[:64]}",
            'from_wallet': source_wallet,
            'to_wallet': intermediate,
            'amount': round(amount_with_fee, 2),
            'token_type': 'ETH',
            'timestamp': current_time.isoformat(),
            'gas_fee': round(random.uniform(0.001, 0.05), 4),
            'transaction_type': 'laundering_chain'
        })
    
    # Fan-in phase
    for intermediate in intermediaries:
        current_time += timedelta(seconds=random.randint(60, 3600))
        transactions.append({
            'transaction_hash': f"0x{uuid.uuid4().hex[:64]}",
            'from_wallet': intermediate,
            'to_wallet': aggregation_wallet,
            'amount': round(amount_per_intermediate * 0.92, 2),
            'token_type': 'ETH',
            'timestamp': current_time.isoformat(),
            'gas_fee': round(random.uniform(0.001, 0.05), 4),
            'transaction_type': 'laundering_chain'
        })
    
    return transactions

def save_dataset(transactions, filename):
    """Save transactions to CSV file."""
    if not transactions:
        return
    
    keys = transactions[0].keys()
    with open(filename, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=keys)
        writer.writeheader()
        writer.writerows(transactions)

# ============================================================================
# DATASET CONFIGURATIONS (5 Different Scenarios)
# ============================================================================

DATASETS = [
    {
        'name': 'small_network.csv',
        'project_name': 'LocalChain DEX',
        'description': 'Small decentralized exchange with minimal suspicious activity. Mostly peer-to-peer trading.',
        'num_wallets': 150,
        'num_chains': 2,
        'normal_transactions': 2000,
        'min_hops': 2,
        'max_hops': 4,
        'min_normal': 0.5,
        'max_normal': 25.0,
        'min_launder': 5.0,
        'max_launder': 30.0,
        'tokens': ['ETH', 'USDC', 'DAI'],
        'start_date': datetime(2024, 1, 1),
        'end_date': datetime(2024, 3, 31),
    },
    {
        'name': 'medium_network.csv',
        'project_name': 'TechFund Treasury',
        'description': 'Medium-sized crypto fund with moderate transaction volume. Several suspicious fan-out patterns detected.',
        'num_wallets': 400,
        'num_chains': 8,
        'normal_transactions': 5000,
        'min_hops': 3,
        'max_hops': 6,
        'min_normal': 1.0,
        'max_normal': 50.0,
        'min_launder': 20.0,
        'max_launder': 100.0,
        'tokens': ['ETH', 'BTC', 'USDT', 'USDC'],
        'start_date': datetime(2024, 1, 1),
        'end_date': datetime(2024, 6, 30),
    },
    {
        'name': 'high_volume_exchange.csv',
        'project_name': 'CryptoHub Exchange',
        'description': 'High-volume exchange with sophisticated layering patterns. Multiple circular transaction loops detected.',
        'num_wallets': 600,
        'num_chains': 15,
        'normal_transactions': 12000,
        'min_hops': 4,
        'max_hops': 8,
        'min_normal': 0.1,
        'max_normal': 100.0,
        'min_launder': 50.0,
        'max_launder': 200.0,
        'tokens': ['ETH', 'BTC', 'USDT', 'USDC', 'DAI'],
        'start_date': datetime(2024, 1, 1),
        'end_date': datetime(2024, 12, 31),
    },
    {
        'name': 'bridge_network.csv',
        'project_name': 'CrossChain Bridge Protocol',
        'description': 'Cross-chain bridge with high-velocity pass-through transactions. Rapid fund movement patterns observed.',
        'num_wallets': 250,
        'num_chains': 10,
        'normal_transactions': 6000,
        'min_hops': 2,
        'max_hops': 5,
        'min_normal': 10.0,
        'max_normal': 150.0,
        'min_launder': 100.0,
        'max_launder': 500.0,
        'tokens': ['BTC', 'USDT', 'USDC'],
        'start_date': datetime(2024, 3, 1),
        'end_date': datetime(2024, 9, 30),
    },
    {
        'name': 'darkpool_network.csv',
        'project_name': 'Privacy Wallet Ecosystem',
        'description': 'Privacy-focused platform with complex structuring patterns. Highly fragmented transactions with multiple mixer interactions.',
        'num_wallets': 800,
        'num_chains': 20,
        'normal_transactions': 15000,
        'min_hops': 5,
        'max_hops': 10,
        'min_normal': 0.01,
        'max_normal': 200.0,
        'min_launder': 75.0,
        'max_launder': 300.0,
        'tokens': ['ETH', 'BTC', 'USDT', 'USDC', 'DAI'],
        'start_date': datetime(2024, 1, 1),
        'end_date': datetime(2024, 12, 31),
    },
]

# ============================================================================
# MAIN EXECUTION
# ============================================================================

if __name__ == "__main__":
    print("=" * 80)
    print("GENERATING 5 SYNTHETIC TRANSACTION DATASETS FOR CHAINSLEDTH DEMO")
    print("=" * 80)
    print()
    
    base_path = os.path.dirname(os.path.abspath(__file__))
    
    for dataset_config in DATASETS:
        print(f"📊 Generating: {dataset_config['name']}")
        print(f"   Project: {dataset_config['project_name']}")
        print(f"   Description: {dataset_config['description']}")
        
        transactions = generate_dataset(dataset_config)
        filepath = os.path.join(base_path, dataset_config['name'])
        save_dataset(transactions, filepath)
        
        print(f"   ✓ Generated {len(transactions):,} transactions")
        print(f"   ✓ Saved to: {dataset_config['name']}")
        print()
    
    print("=" * 80)
    print("SUMMARY: 5 DATASETS READY FOR DEMO")
    print("=" * 80)
    print()
    
    for i, dataset_config in enumerate(DATASETS, 1):
        print(f"{i}. {dataset_config['name']}")
        print(f"   📍 Project: {dataset_config['project_name']}")
        print(f"   📝 {dataset_config['description']}")
        print(f"   🔧 Config: {dataset_config['num_wallets']} wallets, {dataset_config['num_chains']} suspicious chains")
        print()
    
    print("=" * 80)
    print("✓ All datasets generated successfully!")
    print("=" * 80)
