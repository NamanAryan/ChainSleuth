"""
Synthetic Blockchain Transaction Dataset Generator
Purpose: Generate realistic transaction data with embedded money laundering patterns
for testing graph-based AML detection systems.
"""

import csv
import random
import uuid
from datetime import datetime, timedelta

# ============================================================================
# CONFIGURATION PARAMETERS
# ============================================================================

# Dataset size
NUM_WALLETS = 500
TARGET_TRANSACTIONS = 10000  # Will generate between 8,000-12,000

# Laundering chains
NUM_LAUNDERING_CHAINS = 15
MIN_INTERMEDIARIES = 4
MAX_INTERMEDIARIES = 8

# Transaction amounts (in tokens)
MIN_NORMAL_AMOUNT = 0.1
MAX_NORMAL_AMOUNT = 50.0
MIN_LAUNDERING_AMOUNT = 10.0
MAX_LAUNDERING_AMOUNT = 100.0

# Fee simulation for laundering (percentage loss per hop)
MIN_FEE_PERCENT = 1.0
MAX_FEE_PERCENT = 5.0

# Time patterns
START_DATE = datetime(2024, 1, 1)
END_DATE = datetime(2024, 12, 31)
LAUNDERING_HOP_MIN_SECONDS = 5
LAUNDERING_HOP_MAX_SECONDS = 300  # 5 minutes
NORMAL_MIN_HOURS = 1
NORMAL_MAX_HOURS = 72

# Token types
TOKEN_TYPES = ["ETH", "BTC", "USDT", "USDC", "DAI"]
LAUNDERING_TOKEN_TYPE = "ETH"  # Laundering chains use single token type

# Output
OUTPUT_FILE = "synthetic_transactions.csv"

# ============================================================================
# WALLET GENERATION
# ============================================================================

def generate_wallet_address():
    """Generate realistic blockchain-style wallet address (hex format)."""
    return "0x" + uuid.uuid4().hex[:40]

def create_wallet_pool(num_wallets):
    """Create pool of unique wallet addresses."""
    return [generate_wallet_address() for _ in range(num_wallets)]

# ============================================================================
# LAUNDERING CHAIN GENERATION
# ============================================================================

def generate_laundering_chain(wallets, chain_id, base_timestamp):
    """
    Generate a complete money laundering chain:
    1. Source wallet → multiple intermediaries (fan-out)
    2. Intermediaries → aggregation wallet (fan-in)
    
    Returns list of transaction dictionaries.
    """
    transactions = []
    
    # Select unique wallets for this chain
    available_wallets = random.sample(wallets, MIN_INTERMEDIARIES + MAX_INTERMEDIARIES + 2)
    
    # Chain structure
    source_wallet = available_wallets[0]
    num_intermediaries = random.randint(MIN_INTERMEDIARIES, MAX_INTERMEDIARIES)
    intermediaries = available_wallets[1:1+num_intermediaries]
    aggregation_wallet = available_wallets[-1]
    
    # Initial amount to launder
    initial_amount = random.uniform(MIN_LAUNDERING_AMOUNT, MAX_LAUNDERING_AMOUNT)
    
    # Phase 1: Fan-out (source → intermediaries)
    current_time = base_timestamp
    amount_per_intermediate = initial_amount / num_intermediaries
    
    for intermediate in intermediaries:
        # Small random variation in split amounts
        amount_variation = random.uniform(0.95, 1.05)
        amount = amount_per_intermediate * amount_variation
        
        transactions.append({
            "Source_wallet": source_wallet,
            "Dest_wallet": intermediate,
            "timestamp": current_time.isoformat(),
            "amount": round(amount, 6),
            "token_type": LAUNDERING_TOKEN_TYPE
        })
        
        # Short time gap between fan-out transactions
        current_time += timedelta(seconds=random.randint(
            LAUNDERING_HOP_MIN_SECONDS, 
            LAUNDERING_HOP_MAX_SECONDS
        ))
    
    # Phase 2: Fan-in (intermediaries → aggregation)
    # Add small delay before fan-in starts
    current_time += timedelta(seconds=random.randint(60, 300))
    
    for intermediate in intermediaries:
        # Apply fee/loss to simulate transaction costs
        fee_percent = random.uniform(MIN_FEE_PERCENT, MAX_FEE_PERCENT) / 100
        amount_after_fee = amount_per_intermediate * (1 - fee_percent)
        
        transactions.append({
            "Source_wallet": intermediate,
            "Dest_wallet": aggregation_wallet,
            "timestamp": current_time.isoformat(),
            "amount": round(amount_after_fee, 6),
            "token_type": LAUNDERING_TOKEN_TYPE
        })
        
        # Short time gap between fan-in transactions
        current_time += timedelta(seconds=random.randint(
            LAUNDERING_HOP_MIN_SECONDS,
            LAUNDERING_HOP_MAX_SECONDS
        ))
    
    return transactions

# ============================================================================
# NORMAL TRANSACTION GENERATION
# ============================================================================

def generate_normal_transaction(wallets, timestamp):
    """Generate a normal peer-to-peer transaction."""
    # Select two different random wallets
    source, dest = random.sample(wallets, 2)
    
    return {
        "Source_wallet": source,
        "Dest_wallet": dest,
        "timestamp": timestamp.isoformat(),
        "amount": round(random.uniform(MIN_NORMAL_AMOUNT, MAX_NORMAL_AMOUNT), 6),
        "token_type": random.choice(TOKEN_TYPES)
    }

# ============================================================================
# DATASET GENERATION
# ============================================================================

def generate_dataset():
    """Generate complete synthetic dataset with laundering chains and normal transactions."""
    print("=" * 70)
    print("SYNTHETIC BLOCKCHAIN TRANSACTION DATASET GENERATOR")
    print("=" * 70)
    
    # Step 1: Create wallet pool
    print(f"\n[1/4] Generating {NUM_WALLETS} unique wallet addresses...")
    wallets = create_wallet_pool(NUM_WALLETS)
    print(f"✓ Created {len(wallets)} wallets")
    
    # Step 2: Generate laundering chains
    print(f"\n[2/4] Generating {NUM_LAUNDERING_CHAINS} money laundering chains...")
    all_transactions = []
    
    # Distribute laundering chains across the time range
    time_span = (END_DATE - START_DATE).total_seconds()
    time_per_chain = time_span / NUM_LAUNDERING_CHAINS
    
    for i in range(NUM_LAUNDERING_CHAINS):
        # Random timestamp within assigned time window
        chain_start = START_DATE + timedelta(seconds=i * time_per_chain)
        chain_start += timedelta(seconds=random.uniform(0, time_per_chain * 0.8))
        
        chain_transactions = generate_laundering_chain(wallets, i, chain_start)
        all_transactions.extend(chain_transactions)
        
        if (i + 1) % 5 == 0:
            print(f"  Generated {i + 1}/{NUM_LAUNDERING_CHAINS} chains...")
    
    laundering_count = len(all_transactions)
    print(f"✓ Created {laundering_count} laundering transactions")
    
    # Step 3: Generate normal background transactions
    print(f"\n[3/4] Generating normal background transactions...")
    normal_count = TARGET_TRANSACTIONS - laundering_count
    
    for i in range(normal_count):
        # Random timestamp across entire date range
        random_seconds = random.uniform(0, time_span)
        tx_time = START_DATE + timedelta(seconds=random_seconds)
        
        all_transactions.append(generate_normal_transaction(wallets, tx_time))
        
        if (i + 1) % 2000 == 0:
            print(f"  Generated {i + 1}/{normal_count} normal transactions...")
    
    print(f"✓ Created {normal_count} normal transactions")
    
    # Step 4: Sort by timestamp and write to CSV
    print(f"\n[4/4] Writing dataset to {OUTPUT_FILE}...")
    all_transactions.sort(key=lambda x: x["timestamp"])
    
    with open(OUTPUT_FILE, 'w', newline='') as csvfile:
        fieldnames = ["Source_wallet", "Dest_wallet", "timestamp", "amount", "token_type"]
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        
        writer.writeheader()
        writer.writerows(all_transactions)
    
    print(f"✓ Dataset written successfully")
    
    # Summary statistics
    print("\n" + "=" * 70)
    print("DATASET SUMMARY")
    print("=" * 70)
    print(f"Total transactions:        {len(all_transactions):,}")
    print(f"Laundering transactions:   {laundering_count:,} ({laundering_count/len(all_transactions)*100:.1f}%)")
    print(f"Normal transactions:       {normal_count:,} ({normal_count/len(all_transactions)*100:.1f}%)")
    print(f"Unique wallets:            {NUM_WALLETS}")
    print(f"Laundering chains:         {NUM_LAUNDERING_CHAINS}")
    print(f"Date range:                {START_DATE.date()} to {END_DATE.date()}")
    print(f"Output file:               {OUTPUT_FILE}")
    print("=" * 70)
    
    # Pattern detection hints
    print("\nDETECTION PATTERNS TO LOOK FOR:")
    print("─" * 70)
    print("• Fan-out: Single source wallet → multiple destinations (4-8) in short time")
    print("• Fan-in: Multiple sources (4-8) → single destination in short time")
    print("• Multi-hop chains: Fan-out followed by fan-in within minutes")
    print("• Amount patterns: Similar amounts with small fee deductions")
    print("• Time patterns: Transactions clustered within 5-60 seconds")
    print("─" * 70)
    
    return all_transactions

# ============================================================================
# MAIN EXECUTION
# ============================================================================

if __name__ == "__main__":
    try:
        transactions = generate_dataset()
        print("\n✓ SUCCESS: Dataset generation complete!\n")
    except Exception as e:
        print(f"\n✗ ERROR: {str(e)}\n")
        raise
