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

# Pattern counts (diverse suspicious patterns)
NUM_LAUNDERING_CHAINS = 8  # Classic fan-out/fan-in
NUM_CIRCULAR_PATTERNS = 15  # Circular transaction loops (INCREASED)
NUM_LAYERING_PATTERNS = 8  # Complex multi-hop branching (INCREASED)
NUM_STRUCTURING_PATTERNS = 6  # Smurfing (many small transactions) (INCREASED)
NUM_PASSTHROUGH_PATTERNS = 8  # Rapid in-out wallets (INCREASED)
NUM_PEEL_CHAINS = 6  # Linear peel chains (INCREASED)
NUM_MIXER_WALLETS = 5  # Known mixer addresses (INCREASED)

# Laundering chains
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
# CIRCULAR TRANSACTION PATTERNS
# ============================================================================

def generate_circular_pattern(wallets, base_timestamp):
    """
    Generate circular transaction pattern where funds loop back to origin.
    Example: A → B → C → D → A (creates a cycle)
    """
    transactions = []
    
    # Select 3-6 wallets for the cycle
    cycle_length = random.randint(3, 6)
    cycle_wallets = random.sample(wallets, cycle_length)
    
    initial_amount = random.uniform(MIN_LAUNDERING_AMOUNT, MAX_LAUNDERING_AMOUNT)
    current_amount = initial_amount
    current_time = base_timestamp
    
    # Create the cycle: each wallet sends to the next
    for i in range(cycle_length):
        source = cycle_wallets[i]
        dest = cycle_wallets[(i + 1) % cycle_length]  # Loop back to first
        
        # Apply small fee
        fee = random.uniform(0.01, 0.03)
        current_amount *= (1 - fee)
        
        transactions.append({
            "Source_wallet": source,
            "Dest_wallet": dest,
            "timestamp": current_time.isoformat(),
            "amount": round(current_amount, 6),
            "token_type": LAUNDERING_TOKEN_TYPE
        })
        
        current_time += timedelta(seconds=random.randint(30, 180))
    
    return transactions

# ============================================================================
# LAYERING PATTERNS (COMPLEX BRANCHING)
# ============================================================================

def generate_layering_pattern(wallets, base_timestamp):
    """
    Generate layering pattern: funds split through multiple levels of intermediaries.
    Example: A → [B, C] → [D, E, F, G] → [H, I] (tree-like branching)
    """
    transactions = []
    
    # Three-level tree
    source = random.choice(wallets)
    level1 = random.sample([w for w in wallets if w != source], 3)  # 3 intermediaries
    level2 = random.sample([w for w in wallets if w != source and w not in level1], 6)  # 6 more
    final_dest = random.choice([w for w in wallets if w != source and w not in level1 and w not in level2])
    
    initial_amount = random.uniform(MIN_LAUNDERING_AMOUNT * 2, MAX_LAUNDERING_AMOUNT * 2)
    current_time = base_timestamp
    
    # Level 0 → Level 1 (split into 3)
    split_amount = initial_amount / 3
    for wallet in level1:
        transactions.append({
            "Source_wallet": source,
            "Dest_wallet": wallet,
            "timestamp": current_time.isoformat(),
            "amount": round(split_amount * random.uniform(0.95, 1.05), 6),
            "token_type": LAUNDERING_TOKEN_TYPE
        })
        current_time += timedelta(seconds=random.randint(20, 60))
    
    current_time += timedelta(seconds=random.randint(120, 300))
    
    # Level 1 → Level 2 (each splits into 2)
    for i, l1_wallet in enumerate(level1):
        for j in range(2):
            l2_wallet = level2[i * 2 + j]
            transactions.append({
                "Source_wallet": l1_wallet,
                "Dest_wallet": l2_wallet,
                "timestamp": current_time.isoformat(),
                "amount": round(split_amount / 2 * 0.95, 6),
                "token_type": LAUNDERING_TOKEN_TYPE
            })
            current_time += timedelta(seconds=random.randint(15, 45))
    
    current_time += timedelta(seconds=random.randint(180, 400))
    
    # Level 2 → Final (aggregate)
    for l2_wallet in level2:
        transactions.append({
            "Source_wallet": l2_wallet,
            "Dest_wallet": final_dest,
            "timestamp": current_time.isoformat(),
            "amount": round(split_amount / 6 * 0.9, 6),
            "token_type": LAUNDERING_TOKEN_TYPE
        })
        current_time += timedelta(seconds=random.randint(10, 40))
    
    return transactions

# ============================================================================
# STRUCTURING/SMURFING PATTERNS
# ============================================================================

def generate_structuring_pattern(wallets, base_timestamp):
    """
    Generate structuring pattern: many small transactions to avoid detection thresholds.
    Example: A sends 15-25 small transactions (<$10k each) totaling >$100k
    """
    transactions = []
    
    source = random.choice(wallets)
    num_smurfs = random.randint(15, 25)
    destinations = random.sample([w for w in wallets if w != source], num_smurfs)
    
    # Small amounts below threshold
    small_amounts = [random.uniform(3, 9.5) for _ in range(num_smurfs)]  # Under 10k threshold
    
    current_time = base_timestamp
    
    for dest, amount in zip(destinations, small_amounts):
        transactions.append({
            "Source_wallet": source,
            "Dest_wallet": dest,
            "timestamp": current_time.isoformat(),
            "amount": round(amount, 6),
            "token_type": LAUNDERING_TOKEN_TYPE
        })
        # Very short intervals (rapid succession)
        current_time += timedelta(seconds=random.randint(5, 30))
    
    return transactions

# ============================================================================
# RAPID IN-OUT (PASS-THROUGH) PATTERNS
# ============================================================================

def generate_passthrough_pattern(wallets, base_timestamp):
    """
    Generate pass-through wallet: receives funds and immediately sends out 90%+.
    Example: Multiple sources → passthrough → multiple destinations (quick turnover)
    """
    transactions = []
    
    passthrough_wallet = random.choice(wallets)
    num_sources = random.randint(3, 6)
    num_dests = random.randint(3, 6)
    
    sources = random.sample([w for w in wallets if w != passthrough_wallet], num_sources)
    dests = random.sample([w for w in wallets if w != passthrough_wallet and w not in sources], num_dests)
    
    total_inflow = 0
    current_time = base_timestamp
    
    # Inflow phase
    for source in sources:
        amount = random.uniform(15, 40)
        total_inflow += amount
        transactions.append({
            "Source_wallet": source,
            "Dest_wallet": passthrough_wallet,
            "timestamp": current_time.isoformat(),
            "amount": round(amount, 6),
            "token_type": LAUNDERING_TOKEN_TYPE
        })
        current_time += timedelta(seconds=random.randint(10, 60))
    
    # Very short delay before outflow
    current_time += timedelta(seconds=random.randint(30, 120))
    
    # Outflow phase (90-95% of inflow)
    outflow_ratio = random.uniform(0.90, 0.95)
    amount_per_dest = (total_inflow * outflow_ratio) / num_dests
    
    for dest in dests:
        transactions.append({
            "Source_wallet": passthrough_wallet,
            "Dest_wallet": dest,
            "timestamp": current_time.isoformat(),
            "amount": round(amount_per_dest * random.uniform(0.95, 1.05), 6),
            "token_type": LAUNDERING_TOKEN_TYPE
        })
        current_time += timedelta(seconds=random.randint(10, 60))
    
    return transactions

# ============================================================================
# PEEL CHAIN PATTERNS
# ============================================================================

def generate_peel_chain(wallets, base_timestamp):
    """
    Generate peel chain: linear chain with gradual value decrease (peeling off).
    Example: A(100) → B(85) → C(72) → D(61) → E(52) → F(44)
    """
    transactions = []
    
    chain_length = random.randint(5, 8)
    chain_wallets = random.sample(wallets, chain_length)
    
    initial_amount = random.uniform(MIN_LAUNDERING_AMOUNT * 3, MAX_LAUNDERING_AMOUNT * 3)
    current_amount = initial_amount
    current_time = base_timestamp
    
    for i in range(chain_length - 1):
        source = chain_wallets[i]
        dest = chain_wallets[i + 1]
        
        # Peel off 10-20% each hop
        peel_percent = random.uniform(0.10, 0.20)
        current_amount *= (1 - peel_percent)
        
        transactions.append({
            "Source_wallet": source,
            "Dest_wallet": dest,
            "timestamp": current_time.isoformat(),
            "amount": round(current_amount, 6),
            "token_type": LAUNDERING_TOKEN_TYPE
        })
        
        current_time += timedelta(seconds=random.randint(60, 300))
    
    return transactions

# ============================================================================
# MIXER INTERACTION PATTERNS
# ============================================================================

def create_mixer_wallets(wallets):
    """Create known mixer wallet addresses."""
    # Use specific addresses that the backend knows about
    mixers = [
        '0x0000000000000000000000000000000000000000',  # Zero address
        '0xdeaddeaddeaddeaddeaddeaddeaddeaddead',  # Mixer pattern (matches backend)
    ]
    return mixers

def generate_mixer_interactions(wallets, mixer_wallets, base_timestamp):
    """
    Generate interactions with known mixer services.
    Example: Regular wallet → mixer → different wallet
    """
    transactions = []
    
    num_users = random.randint(4, 7)
    users = random.sample(wallets, num_users)
    mixer = random.choice(mixer_wallets)
    
    current_time = base_timestamp
    total_in_mixer = 0
    
    # Multiple wallets send to mixer
    for user in users:
        amount = random.uniform(10, 50)
        total_in_mixer += amount
        transactions.append({
            "Source_wallet": user,
            "Dest_wallet": mixer,
            "timestamp": current_time.isoformat(),
            "amount": round(amount, 6),
            "token_type": LAUNDERING_TOKEN_TYPE
        })
        current_time += timedelta(seconds=random.randint(30, 180))
    
    # Delay for mixing
    current_time += timedelta(seconds=random.randint(600, 1800))
    
    # Mixer sends to different wallets (shuffled)
    output_wallets = random.sample([w for w in wallets if w not in users], num_users)
    amount_per_output = (total_in_mixer * 0.97) / num_users  # 3% mixer fee
    
    for output_wallet in output_wallets:
        transactions.append({
            "Source_wallet": mixer,
            "Dest_wallet": output_wallet,
            "timestamp": current_time.isoformat(),
            "amount": round(amount_per_output * random.uniform(0.95, 1.05), 6),
            "token_type": LAUNDERING_TOKEN_TYPE
        })
        current_time += timedelta(seconds=random.randint(20, 120))
    
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
    """Generate complete synthetic dataset with diverse laundering patterns."""
    print("=" * 70)
    print("SYNTHETIC BLOCKCHAIN TRANSACTION DATASET GENERATOR")
    print("=" * 70)
    
    # Step 1: Create wallet pool
    print(f"\n[1/5] Generating {NUM_WALLETS} unique wallet addresses...")
    wallets = create_wallet_pool(NUM_WALLETS)
    mixer_wallets = create_mixer_wallets(wallets)
    print(f"✓ Created {len(wallets)} wallets + {len(mixer_wallets)} mixer addresses")
    
    # Step 2: Generate diverse suspicious patterns
    print(f"\n[2/5] Generating diverse money laundering patterns...")
    all_transactions = []
    
    time_span = (END_DATE - START_DATE).total_seconds()
    
    # Classic fan-out/fan-in chains
    print(f"  • Generating {NUM_LAUNDERING_CHAINS} fan-out/fan-in chains...")
    time_per_chain = time_span / (NUM_LAUNDERING_CHAINS * 5)
    for i in range(NUM_LAUNDERING_CHAINS):
        chain_start = START_DATE + timedelta(seconds=i * time_per_chain * 5)
        chain_start += timedelta(seconds=random.uniform(0, time_per_chain * 3))
        chain_transactions = generate_laundering_chain(wallets, i, chain_start)
        all_transactions.extend(chain_transactions)
    
    # Circular patterns
    print(f"  • Generating {NUM_CIRCULAR_PATTERNS} circular transaction loops...")
    for i in range(NUM_CIRCULAR_PATTERNS):
        pattern_start = START_DATE + timedelta(seconds=random.uniform(0, time_span))
        all_transactions.extend(generate_circular_pattern(wallets, pattern_start))
    
    # Layering patterns
    print(f"  • Generating {NUM_LAYERING_PATTERNS} layering patterns...")
    for i in range(NUM_LAYERING_PATTERNS):
        pattern_start = START_DATE + timedelta(seconds=random.uniform(0, time_span))
        all_transactions.extend(generate_layering_pattern(wallets, pattern_start))
    
    # Structuring/smurfing
    print(f"  • Generating {NUM_STRUCTURING_PATTERNS} structuring patterns...")
    for i in range(NUM_STRUCTURING_PATTERNS):
        pattern_start = START_DATE + timedelta(seconds=random.uniform(0, time_span))
        all_transactions.extend(generate_structuring_pattern(wallets, pattern_start))
    
    # Pass-through wallets
    print(f"  • Generating {NUM_PASSTHROUGH_PATTERNS} pass-through patterns...")
    for i in range(NUM_PASSTHROUGH_PATTERNS):
        pattern_start = START_DATE + timedelta(seconds=random.uniform(0, time_span))
        all_transactions.extend(generate_passthrough_pattern(wallets, pattern_start))
    
    # Peel chains
    print(f"  • Generating {NUM_PEEL_CHAINS} peel chains...")
    for i in range(NUM_PEEL_CHAINS):
        pattern_start = START_DATE + timedelta(seconds=random.uniform(0, time_span))
        all_transactions.extend(generate_peel_chain(wallets, pattern_start))
    
    # Mixer interactions
    print(f"  • Generating {NUM_MIXER_WALLETS} mixer interaction patterns...")
    for i in range(NUM_MIXER_WALLETS):
        pattern_start = START_DATE + timedelta(seconds=random.uniform(0, time_span))
        all_transactions.extend(generate_mixer_interactions(wallets, mixer_wallets, pattern_start))
    
    laundering_count = len(all_transactions)
    print(f"✓ Created {laundering_count} suspicious transactions across 7 pattern types")
    
    # Step 3: Generate normal background transactions
    print(f"\n[3/5] Generating normal background transactions...")
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
    print(f"\n[4/5] Writing dataset to {OUTPUT_FILE}...")
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
    print(f"Suspicious transactions:   {laundering_count:,} ({laundering_count/len(all_transactions)*100:.1f}%)")
    print(f"Normal transactions:       {normal_count:,} ({normal_count/len(all_transactions)*100:.1f}%)")
    print(f"Unique wallets:            {NUM_WALLETS}")
    print(f"Date range:                {START_DATE.date()} to {END_DATE.date()}")
    print(f"Output file:               {OUTPUT_FILE}")
    print("=" * 70)
    
    # Pattern breakdown
    print("\nSUSPICIOUS PATTERN BREAKDOWN:")
    print("─" * 70)
    print(f"• Classic fan-out/fan-in chains:     {NUM_LAUNDERING_CHAINS}")
    print(f"• Circular transaction loops:        {NUM_CIRCULAR_PATTERNS}")
    print(f"• Layering patterns (multi-branch):  {NUM_LAYERING_PATTERNS}")
    print(f"• Structuring/smurfing:              {NUM_STRUCTURING_PATTERNS}")
    print(f"• Pass-through (rapid in-out):       {NUM_PASSTHROUGH_PATTERNS}")
    print(f"• Peel chains:                       {NUM_PEEL_CHAINS}")
    print(f"• Mixer interactions:                {NUM_MIXER_WALLETS}")
    print("─" * 70)
    print("\nDETECTION PATTERNS TO LOOK FOR:")
    print("• Fan-out/fan-in: Single source → multiple → single destination")
    print("• Circular: Funds return to origin (A → B → C → A)")
    print("• Layering: Complex multi-level branching trees")
    print("• Structuring: Many small transactions (<$10k) totaling >$100k")
    print("• Pass-through: Receive funds and quickly send out 90%+")
    print("• Peel chain: Linear chain with decreasing amounts")
    print("• Mixer: Interactions with known mixer addresses")
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
