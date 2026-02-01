from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Header, Form
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List, Dict, Any
import os
import random
from dotenv import load_dotenv
from supabase import create_client, Client
import pandas as pd
import io
from datetime import datetime, timedelta
from pydantic import BaseModel
from collections import defaultdict, deque
import ollama
import json

# Load environment variables
load_dotenv()

print("=" * 50)
print("ChainSleuth Backend Starting...")
print("=" * 50)

app = FastAPI(
    title="ChainSleuth API",
    description="Interactive Money Laundering Detection in Crypto Transaction Networks",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

print(f"CORS configured for: http://localhost:5173")

# Supabase client
supabase_url = os.getenv("SUPABASE_URL", "")
supabase_key = os.getenv("SUPABASE_KEY", "")

print(f"Connecting to Supabase...")
print(f"URL: {supabase_url}")
print(f"Key: {'*' * 20}...{supabase_key[-10:] if len(supabase_key) > 10 else 'MISSING'}")

try:
    supabase: Client = create_client(supabase_url, supabase_key)
    print("✓ Supabase connected successfully!")
except Exception as e:
    print(f"✗ Supabase connection failed: {e}")
    raise

print("=" * 50)

# Pydantic models
class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None

class ProjectResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    dataset: Optional[str]
    createdAt: str
    walletCount: int
    analyses: int

class WalletResponse(BaseModel):
    id: str
    hash: str
    x: float
    y: float
    riskScore: int
    inflow: float
    outflow: float
    transactionCount: int

class TransactionResponse(BaseModel):
    id: str
    from_wallet: str
    to_wallet: str
    amount: float
    timestamp: Optional[str]
    token_type: str

class AnalysisResponse(BaseModel):
    wallets: List[WalletResponse]
    transactions: List[TransactionResponse]
    statistics: dict

class NoteCreate(BaseModel):
    entity_type: str  # "project", "wallet", "pattern"
    entity_id: str
    content: str

class NoteResponse(BaseModel):
    id: str
    project_id: str
    entity_type: str
    entity_id: str
    content: str
    created_by: str
    created_at: str

class AssistantContext(BaseModel):
    project: Optional[Dict[str, Any]] = None
    wallet: Optional[Dict[str, Any]] = None
    pattern: Optional[Dict[str, Any]] = None

class AssistantRequest(BaseModel):
    question: str
    context: Optional[AssistantContext] = None

class AssistantResponse(BaseModel):
    response: str
    context_used: bool

# Dependency to get current user from JWT and create user-specific client
async def get_current_user(authorization: str = Header(...)):
    if not authorization:
        print("❌ Auth failed: No authorization header")
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        token = authorization.replace("Bearer ", "")
        user = supabase.auth.get_user(token)
        if user and user.user:
            print(f"✓ User authenticated: {user.user.email}")
        else:
            print(f"✓ User authenticated: Unknown")
        
        # Create user-specific Supabase client with their JWT token
        # This ensures RLS policies work correctly
        user_supabase = create_client(supabase_url, supabase_key)
        user_supabase.postgrest.auth(token)
        
        return {"user": user, "supabase": user_supabase}
    except Exception as e:
        print(f"❌ Auth failed: {str(e)}")
        raise HTTPException(status_code=401, detail=str(e))

# ============================================================================
# ADVANCED PATTERN DETECTION FUNCTIONS
# ============================================================================

def detect_circular_transactions(tx_graph: dict, transactions: list, time_tolerance_hours: int = 24) -> dict:
    """Detect circular transactions (funds returning to origin within time window)"""
    from datetime import datetime, timedelta
    
    circular_wallets = defaultdict(int)
    
    # Build transaction timestamp map
    tx_time_map = {}
    for tx in transactions:
        key = f"{tx['from_wallet']}->{tx['to_wallet']}"
        if tx.get('timestamp'):
            try:
                tx_time_map[key] = datetime.fromisoformat(tx['timestamp'].replace('Z', '+00:00'))
            except:
                pass
    
    def find_cycles(start: str, current: str, path: list, visited: set, depth: int = 0, start_time=None) -> list:
        if depth > 6:  # Max cycle length
            return []
        
        cycles = []
        neighbors = tx_graph.get(current, {}).get('out', set())
        
        for neighbor in neighbors:
            if neighbor == start and len(path) >= 3:  # Cycle found
                # Check time constraint if timestamps available
                if start_time:
                    end_key = f"{current}->{neighbor}"
                    if end_key in tx_time_map:
                        end_time = tx_time_map[end_key]
                        time_diff = (end_time - start_time).total_seconds() / 3600  # hours
                        if time_diff <= time_tolerance_hours:
                            cycles.append(path + [neighbor])
                else:
                    # No timestamp data, include cycle
                    cycles.append(path + [neighbor])
            elif neighbor not in visited and depth < 6:
                # Get start time for first hop
                first_hop_time = start_time
                if not first_hop_time:
                    first_key = f"{start}->{path[1] if len(path) > 1 else neighbor}"
                    first_hop_time = tx_time_map.get(first_key)
                
                cycles.extend(find_cycles(start, neighbor, path + [neighbor], visited | {neighbor}, depth + 1, first_hop_time))
        
        return cycles
    
    # Find cycles from each wallet
    processed = set()
    for wallet in tx_graph.keys():
        if wallet not in processed:
            cycles = find_cycles(wallet, wallet, [wallet], set())
            if cycles:
                # Mark all wallets in cycles as processed
                for cycle in cycles:
                    for w in cycle:
                        processed.add(w)
                circular_wallets[wallet] = len(cycles)
    
    print(f"    Found {len(circular_wallets)} wallet clusters with {sum(circular_wallets.values())} total cycles")
    return dict(circular_wallets)

def detect_layering_pattern(tx_graph: dict, transactions: list) -> dict:
    """Detect layering (funds split through multiple intermediaries)"""
    layering_wallets = {}
    
    def bfs_branching(start: str) -> int:
        """Count branching paths up to depth 3"""
        visited = {start}
        queue = deque([(start, 0, 1)])  # (node, depth, branch_count)
        max_branches = 1
        intermediaries = set()
        
        while queue:
            node, depth, branches = queue.popleft()
            if depth >= 3:
                continue
            
            neighbors = tx_graph.get(node, {}).get('out', set())
            if len(neighbors) >= 2:
                max_branches = max(max_branches, len(neighbors))
                intermediaries.update(neighbors)
            
            for neighbor in neighbors:
                if neighbor not in visited:
                    visited.add(neighbor)
                    queue.append((neighbor, depth + 1, len(neighbors)))
        
        return max_branches if len(intermediaries) >= 5 else 0
    
    for wallet in tx_graph.keys():
        branches = bfs_branching(wallet)
        if branches >= 2:
            layering_wallets[wallet] = branches
    
    return layering_wallets

def detect_structuring_pattern(wallets_dict: dict, transactions: list, small_tx_threshold: float = 10000, time_window_hours: int = 1) -> dict:
    """Detect structuring/smurfing (many small txs to avoid thresholds)"""
    structuring_wallets = {}
    
    for wallet, stats in wallets_dict.items():
        # Count outgoing small transactions
        small_tx_count = 0
        for tx in transactions:
            if tx['from_wallet'] == wallet and tx['amount'] < small_tx_threshold:
                small_tx_count += 1
        
        # Flag if ≥10 small transfers with high total volume
        if small_tx_count >= 10 and stats['outflow'] > 100000:
            structuring_wallets[wallet] = small_tx_count
    
    return structuring_wallets

def detect_rapid_inout_pattern(wallets_dict: dict, transactions: list, holding_time_minutes: int = 10) -> dict:
    """Detect rapid in-out (pass-through wallets)"""
    passthrough_wallets = {}
    
    for wallet, stats in wallets_dict.items():
        if stats['inflow'] > 0 and stats['outflow'] >= stats['inflow'] * 0.9:  # ≥90% of inflow
            passthrough_wallets[wallet] = (stats['outflow'] / stats['inflow']) if stats['inflow'] > 0 else 0
    
    return passthrough_wallets

def detect_dormant_activation(wallets_dict: dict, transactions: list, dormant_days: int = 90) -> dict:
    """Detect dormant wallet activation"""
    activated_wallets = {}
    
    for wallet, stats in wallets_dict.items():
        # In this context, assume all wallets in dataset are "recently activated"
        # In production, track historical inactivity from timestamps
        high_activity = stats['tx_count'] >= 20 and (stats['inflow'] > 100000 or stats['outflow'] > 100000)
        if high_activity:
            activated_wallets[wallet] = stats['tx_count']
    
    return activated_wallets

def detect_mixer_interaction(tx_graph: dict, wallets_dict: dict) -> dict:
    """Detect mixer/tumbler interaction"""
    known_mixers = {
        # Common mixer patterns - in production, maintain active list
        '0x0000000000000000000000000000000000000000',  # Zero address
        '0xdeaddeaddeaddeaddeaddeaddeaddeaddead',  # Common test mixer
    }
    
    mixer_wallets = {}
    for wallet in tx_graph.keys():
        neighbors_in = tx_graph.get(wallet, {}).get('in', set())
        neighbors_out = tx_graph.get(wallet, {}).get('out', set())
        
        if any(n in known_mixers for n in neighbors_in) or any(n in known_mixers for n in neighbors_out):
            mixer_wallets[wallet] = 1
    
    return mixer_wallets

def detect_peel_chain(tx_graph: dict, transactions: list) -> dict:
    """Detect peel chain (sequential value peeling)"""
    peel_chains = {}
    
    def find_linear_chains(start: str, chain: Optional[list] = None) -> list:
        if chain is None:
            chain = [start]
        
        if len(chain) >= 5:  # Chain length ≥5
            return [chain]
        
        neighbors = tx_graph.get(chain[-1], {}).get('out', set())
        chains = []
        
        if len(neighbors) == 1:  # Linear continuation
            next_node = list(neighbors)[0]
            chains.extend(find_linear_chains(next_node, chain + [next_node]))
        elif len(chain) >= 5:
            chains.append(chain)
        
        return chains
    
    for wallet in tx_graph.keys():
        chains = find_linear_chains(wallet)
        if chains:
            peel_chains[wallet] = len(chains[0]) if chains else 0
    
    return peel_chains

@app.get("/")
async def root():
    """Root endpoint"""
    print("📍 Root endpoint hit")
    return {
        "message": "ChainSleuth API",
        "status": "operational",
        "version": "1.0.0"
    }

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    print("📍 Health check endpoint hit")
    return {"status": "healthy"}


@app.get("/api/user/profile")
async def get_user_profile(auth_context = Depends(get_current_user)):
    """Get current user profile"""
    user = auth_context["user"]
    return {
        "user": user.user.email if user.user else None,
        "id": user.user.id if user.user else None
    }


@app.post("/api/analysis/upload")
async def upload_dataset(
    file: UploadFile = File(...),
    user = Depends(get_current_user)
):
    """
    Upload CSV dataset for analysis
    Expected columns: source_wallet, destination_wallet, timestamp, amount, token_type
    """
    try:
        # Read CSV file
        contents = await file.read()
        df = pd.read_csv(io.StringIO(contents.decode('utf-8')))
        
        # Validate required columns
        required_columns = ['source_wallet', 'destination_wallet', 'timestamp', 'amount', 'token_type']
        missing_columns = [col for col in required_columns if col not in df.columns]
        
        if missing_columns:
            raise HTTPException(
                status_code=400,
                detail=f"Missing required columns: {', '.join(missing_columns)}"
            )
        
        # Basic statistics
        stats = {
            "total_transactions": len(df),
            "unique_wallets": len(set(df['source_wallet'].tolist() + df['destination_wallet'].tolist())),
            "date_range": {
                "start": df['timestamp'].min(),
                "end": df['timestamp'].max()
            },
            "total_amount": float(df['amount'].sum()),
            "token_types": df['token_type'].unique().tolist()
        }
        
        return {
            "message": "Dataset uploaded successfully",
            "filename": file.filename,
            "statistics": stats
        }
        
    except pd.errors.ParserError:
        raise HTTPException(status_code=400, detail="Invalid CSV format")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/projects")
async def get_projects(auth_context = Depends(get_current_user)):
    """Get all projects for the current user"""
    try:
        user = auth_context["user"]
        user_supabase = auth_context["supabase"]
        user_id = user.user.id
        print(f"📂 Fetching projects for user: {user_id}")
        response = user_supabase.table('projects').select("*").eq('user_id', user_id).execute()
        
        projects = []
        for proj in response.data:
            # Get wallet count for this project
            wallets = user_supabase.table('wallets').select("id").eq('project_id', proj['id']).execute()
            wallet_count = len(wallets.data) if wallets.data else 0
            
            projects.append({
                "id": proj['id'],
                "name": proj['name'],
                "description": proj.get('description'),
                "dataset": proj.get('dataset_name'),
                "createdAt": proj['created_at'],
                "userId": proj['user_id'],
                "walletCount": wallet_count
            })
        
        print(f"✓ Found {len(projects)} projects")
        return projects
    except Exception as e:
        print(f"❌ Error fetching projects: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/projects")
async def create_project(
    name: str = Form(...),
    description: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    auth_context = Depends(get_current_user)
):
    """Create a new project"""
    try:
        user = auth_context["user"]
        user_supabase = auth_context["supabase"]
        user_id = user.user.id
        print(f"📝 Creating project '{name}' for user: {user_id}")
        
        # Create project first
        project_data = {
            "user_id": user_id,
            "name": name,
            "description": description,
            "created_at": datetime.utcnow().isoformat()
        }
        
        # If CSV file is uploaded, store filename
        if file:
            project_data["dataset_name"] = file.filename
            print(f"📄 CSV file attached: {file.filename}")
        
        response = user_supabase.table('projects').insert(project_data).execute()
        created_project = response.data[0]
        project_id = created_project['id']
        print(f"✓ Project created with ID: {project_id}")
        
        # Process CSV if uploaded
        wallet_count = 0
        if file:
            try:
                print(f"📊 Processing CSV file...")
                contents = await file.read()
                df = pd.read_csv(io.StringIO(contents.decode('utf-8')))
                
                # Accept flexible column names
                column_mapping = {}
                for col in df.columns:
                    col_lower = col.lower().strip()
                    if 'from' in col_lower or 'source' in col_lower:
                        column_mapping['from_wallet'] = col
                    elif 'to' in col_lower or 'dest' in col_lower or 'target' in col_lower:
                        column_mapping['to_wallet'] = col
                    elif 'amount' in col_lower or 'value' in col_lower:
                        column_mapping['amount'] = col
                    elif 'time' in col_lower or 'date' in col_lower:
                        column_mapping['timestamp'] = col
                    elif 'token' in col_lower or 'currency' in col_lower or 'type' in col_lower:
                        column_mapping['token_type'] = col
                
                # Check if we have required columns
                if 'from_wallet' not in column_mapping or 'to_wallet' not in column_mapping or 'amount' not in column_mapping:
                    raise HTTPException(
                        status_code=400,
                        detail="CSV must contain columns for: from/source address, to/destination address, and amount"
                    )
                
                # Process transactions
                transactions_to_insert = []
                wallets_dict = {}
                
                for _, row in df.iterrows():
                    from_wallet = str(row[column_mapping['from_wallet']])
                    to_wallet = str(row[column_mapping['to_wallet']])
                    amount = float(row[column_mapping['amount']])
                    
                    # Get timestamp if available
                    timestamp = None
                    if 'timestamp' in column_mapping:
                        timestamp = str(row[column_mapping['timestamp']])
                    
                    # Get token type if available
                    token_type = 'ETH'
                    if 'token_type' in column_mapping:
                        token_type = str(row[column_mapping['token_type']])
                    
                    # Track wallets
                    if from_wallet not in wallets_dict:
                        wallets_dict[from_wallet] = {'inflow': 0, 'outflow': 0, 'tx_count': 0}
                    if to_wallet not in wallets_dict:
                        wallets_dict[to_wallet] = {'inflow': 0, 'outflow': 0, 'tx_count': 0}
                    
                    wallets_dict[from_wallet]['outflow'] += amount
                    wallets_dict[from_wallet]['tx_count'] += 1
                    wallets_dict[to_wallet]['inflow'] += amount
                    wallets_dict[to_wallet]['tx_count'] += 1
                    
                    transactions_to_insert.append({
                        "project_id": project_id,
                        "from_wallet": from_wallet,
                        "to_wallet": to_wallet,
                        "amount": amount,
                        "timestamp": timestamp,
                        "token_type": token_type
                    })
                
                # Insert transactions in batches
                if transactions_to_insert:
                    batch_size = 100
                    for i in range(0, len(transactions_to_insert), batch_size):
                        batch = transactions_to_insert[i:i + batch_size]
                        user_supabase.table('transactions').insert(batch).execute()
                
                # Build adjacency list for chain detection
                tx_graph = {}
                for transaction in transactions_to_insert:
                    src = transaction['from_wallet']
                    dst = transaction['to_wallet']
                    if src not in tx_graph:
                        tx_graph[src] = {'out': set(), 'in': set()}
                    if dst not in tx_graph:
                        tx_graph[dst] = {'out': set(), 'in': set()}
                    tx_graph[src]['out'].add(dst)
                    tx_graph[dst]['in'].add(src)
                
                print(f"  Graph built: {len(tx_graph)} nodes in adjacency list")
                
                # Run advanced pattern detection
                print("  Detecting advanced AML patterns...")
                circular_txs = detect_circular_transactions(tx_graph, transactions_to_insert)
                layering = detect_layering_pattern(tx_graph, transactions_to_insert)
                structuring = detect_structuring_pattern(wallets_dict, transactions_to_insert)
                passthrough = detect_rapid_inout_pattern(wallets_dict, transactions_to_insert)
                dormant_activation = detect_dormant_activation(wallets_dict, transactions_to_insert)
                mixer_interaction = detect_mixer_interaction(tx_graph, wallets_dict)
                peel_chains = detect_peel_chain(tx_graph, transactions_to_insert)
                
                print(f"    Circular transactions: {len(circular_txs)}")
                print(f"    Layering patterns: {len(layering)}")
                print(f"    Structuring/Smurfing: {len(structuring)}")
                print(f"    Pass-through wallets: {len(passthrough)}")
                print(f"    Dormant activations: {len(dormant_activation)}")
                print(f"    Mixer interactions: {len(mixer_interaction)}")
                print(f"    Peel chains: {len(peel_chains)}")
                
                # Insert wallets with enhanced risk scoring
                wallets_to_insert = []
                risk_scores_list = []
                intermediary_count = 0
                max_in_degree = 0
                max_out_degree = 0
                for wallet_hash, stats in wallets_dict.items():
                    risk_score = 0
                    
                    # Pattern 1: Chain/Mixing detection - detect intermediary behavior
                    # Intermediaries have multiple in AND multiple out connections
                    in_degree = len(tx_graph.get(wallet_hash, {}).get('in', set()))
                    out_degree = len(tx_graph.get(wallet_hash, {}).get('out', set()))
                    
                    max_in_degree = max(max_in_degree, in_degree)
                    max_out_degree = max(max_out_degree, out_degree)
                    
                    # Intermediary wallet (suspicious mixing/layering activity)
                    if in_degree >= 3 and out_degree >= 3:
                        risk_score += 60  # High risk - clear intermediary/mixing pattern
                        intermediary_count += 1
                    elif in_degree >= 2 and out_degree >= 2:
                        risk_score += 40  # Medium risk - potential mixing
                    
                    # Pattern 2: High fan-in (concentration point - many senders)
                    if in_degree >= 50:
                        risk_score += 55  # Major aggregation point
                    elif in_degree >= 20:
                        risk_score += 45  # Significant aggregation
                    elif in_degree >= 10:
                        risk_score += 35  # Moderate aggregation
                    elif in_degree > 0 and out_degree == 0 and stats['inflow'] > 100:
                        risk_score += 25  # Simple sink
                    
                    # Pattern 3: Source wallet (distribution point)
                    if out_degree > 0 and in_degree == 0 and stats['outflow'] > 100:
                        risk_score += 35  # Source of funds
                    
                    # Pattern 4: Imbalanced inflow/outflow (loss of value = fee evasion)
                    if stats['inflow'] > 0 and stats['outflow'] > 0:
                        ratio = max(stats['outflow'] / stats['inflow'], stats['inflow'] / stats['outflow']) if min(stats['inflow'], stats['outflow']) > 0 else 1
                        if ratio > 3:
                            risk_score += 25  # Large value loss
                        elif ratio > 2:
                            risk_score += 15  # Moderate value loss
                        elif ratio > 1.3:
                            risk_score += 8   # Small value loss
                    
                    # Pattern 5: High transaction volume (even at lower thresholds for this dataset)
                    if stats['tx_count'] > 40:
                        risk_score += 15
                    elif stats['tx_count'] > 30:
                        risk_score += 8
                    
                    # NEW ADVANCED PATTERNS
                    # Pattern 6: Circular Transactions (Looping)
                    if wallet_hash in circular_txs:
                        risk_score += 35  # Value moves in cycles back to origin
                    
                    # Pattern 7: Layering Pattern (Multi-hop Distribution)
                    if wallet_hash in layering:
                        risk_score += 30  # Funds split through multiple intermediaries
                    
                    # Pattern 8: Structuring/Smurfing (Many small transactions)
                    if wallet_hash in structuring:
                        risk_score += 32  # Many small transfers to avoid thresholds
                    
                    # Pattern 9: Rapid In-Out (Pass-Through Wallets)
                    if wallet_hash in passthrough:
                        risk_score += 28  # Quick in and out (≥90% of inflow)
                    
                    # Pattern 10: Dormant Wallet Activation
                    if wallet_hash in dormant_activation:
                        risk_score += 25  # Sudden activity after dormancy
                    
                    # Pattern 11: Mixer Interaction
                    if wallet_hash in mixer_interaction:
                        risk_score += 40  # Interaction with known mixing services
                    
                    # Pattern 12: Peel Chain (Sequential Value Peeling)
                    if wallet_hash in peel_chains:
                        risk_score += 27  # Long linear chains with gradual peeling
                    
                    wallets_to_insert.append({
                        "project_id": project_id,
                        "wallet_hash": wallet_hash,
                        "risk_score": min(risk_score, 100),
                        "inflow": stats['inflow'],
                        "outflow": stats['outflow'],
                        "transaction_count": stats['tx_count'],
                        "position_x": random.uniform(-300, 300),
                        "position_y": random.uniform(-250, 250)
                    })
                    risk_scores_list.append(min(risk_score, 100))
                
                # Insert wallets
                if wallets_to_insert:
                    user_supabase.table('wallets').insert(wallets_to_insert).execute()
                    wallet_count = len(wallets_to_insert)
                    avg_risk = sum(risk_scores_list) / len(risk_scores_list) if risk_scores_list else 0
                    high_risk_count = len([r for r in risk_scores_list if r >= 70])
                    print(f"✓ CSV processed: {len(transactions_to_insert)} transactions, {wallet_count} wallets")
                    print(f"  Risk scores: avg={avg_risk:.1f}, high-risk (≥70)={high_risk_count}")
                    print(f"  Intermediaries detected: {intermediary_count}")
                    print(f"  Max in_degree: {max_in_degree}, Max out_degree: {max_out_degree}")
                    print(f"  Risk distribution: min={min(risk_scores_list) if risk_scores_list else 0}, max={max(risk_scores_list) if risk_scores_list else 0}")
                    
            except pd.errors.ParserError:
                print(f"⚠️ CSV parsing failed, project created without data")
            except Exception as csv_err:
                print(f"⚠️ CSV processing error: {csv_err}")
        
        print(f"✓ Project creation complete")
        return {
            "id": created_project['id'],
            "name": created_project['name'],
            "description": created_project.get('description'),
            "dataset": created_project.get('dataset_name'),
            "createdAt": created_project['created_at'],
            "walletCount": wallet_count
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error creating project: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/projects/{project_id}")
async def delete_project(project_id: str, auth_context = Depends(get_current_user)):
    """Delete a project"""
    try:
        user = auth_context["user"]
        user_supabase = auth_context["supabase"]
        user_id = user.user.id
        print(f"🗑️ Deleting project {project_id} for user: {user_id}")
        
        # Verify ownership
        project = user_supabase.table('projects').select("*").eq('id', project_id).eq('user_id', user_id).execute()
        if not project.data:
            print(f"❌ Project not found or access denied")
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Delete cascading
        print(f"Deleting related data...")
        user_supabase.table('wallets').delete().eq('project_id', project_id).execute()
        user_supabase.table('transactions').delete().eq('project_id', project_id).execute()
        user_supabase.table('analyses').delete().eq('project_id', project_id).execute()
        user_supabase.table('projects').delete().eq('id', project_id).execute()
        
        print(f"✓ Project deleted successfully")
        return {"message": "Project deleted"}
        
    except Exception as e:
        print(f"❌ Error deleting project: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
@app.get("/api/projects/{project_id}/analysis")
async def get_project_analysis(project_id: str, auth_context = Depends(get_current_user)):
    """Get analysis data (wallets and transactions) for a project"""
    try:
        user = auth_context["user"]
        user_supabase = auth_context["supabase"]
        user_id = user.user.id
        print(f"📈 Fetching analysis for project {project_id}")
        
        # Verify ownership
        project = user_supabase.table('projects').select("*").eq('id', project_id).eq('user_id', user_id).execute()
        if not project.data:
            raise HTTPException(status_code=404, detail="Project not found")
        
        project_data = project.data[0]
        
        # Get wallets
        wallets_response = user_supabase.table('wallets').select("*").eq('project_id', project_id).execute()
        wallets = []
        for w in wallets_response.data:
            wallets.append({
                "id": w['id'],
                "hash": w['wallet_hash'],
                "x": float(w.get('position_x', 0)),
                "y": float(w.get('position_y', 0)),
                "riskScore": int(w.get('risk_score', 0)),
                "inflow": float(w.get('inflow', 0.0)),
                "outflow": float(w.get('outflow', 0.0)),
                "transactionCount": int(w.get('transaction_count', 0))
            })
        
        # Get transactions
        tx_response = user_supabase.table('transactions').select("*").eq('project_id', project_id).execute()
        transactions = []
        for tx in tx_response.data:
            transactions.append({
                "id": tx['id'],
                "from_wallet": tx['from_wallet'],
                "to_wallet": tx['to_wallet'],
                "amount": float(tx['amount']),
                "timestamp": tx.get('timestamp'),
                "token_type": tx.get('token_type', 'ETH')
            })
        
        # Calculate statistics
        stats = {
            "totalTransactions": len(transactions),
            "uniqueWallets": len(wallets),
            "suspiciousWallets": len([w for w in wallets if w['riskScore'] > 50]),
            "totalVolume": sum(t['amount'] for t in transactions)
        }
        
        print(f"✓ Analysis data ready: {len(wallets)} wallets, {len(transactions)} transactions")
        return {
            "name": project_data['name'],
            "wallets": wallets,
            "transactions": transactions,
            "statistics": stats
        }
    except Exception as e:
        print(f"❌ Error fetching analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/notes")
async def create_note(
    project_id: str = Form(...),
    entity_type: str = Form(...),
    entity_id: str = Form(...),
    content: str = Form(...),
    auth_context = Depends(get_current_user)
):
    """Create a new note for an investigation entity"""
    try:
        user = auth_context["user"]
        user_supabase = auth_context["supabase"]
        user_id = user.user.id
        
        # Validate entity_type
        if entity_type not in ["project", "wallet", "pattern"]:
            raise HTTPException(status_code=400, detail="Invalid entity_type")
        
        # Verify project ownership
        project = user_supabase.table('projects').select("id").eq('id', project_id).eq('user_id', user_id).execute()
        if not project.data:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Create note
        note_data = {
            "project_id": project_id,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "content": content,
            "created_by": user_id,
            "created_at": datetime.utcnow().isoformat()
        }
        
        response = user_supabase.table('notes').insert(note_data).execute()
        created_note = response.data[0]
        
        print(f"✓ Note created: {entity_type}/{entity_id}")
        return {
            "id": created_note['id'],
            "project_id": created_note['project_id'],
            "entity_type": created_note['entity_type'],
            "entity_id": created_note['entity_id'],
            "content": created_note['content'],
            "created_by": created_note['created_by'],
            "created_at": created_note['created_at']
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error creating note: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/notes")
async def get_notes(
    project_id: str,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    auth_context = Depends(get_current_user)
):
    """Get notes for a specific entity or project"""
    try:
        user = auth_context["user"]
        user_supabase = auth_context["supabase"]
        user_id = user.user.id
        
        # Verify project ownership
        project = user_supabase.table('projects').select("id").eq('id', project_id).eq('user_id', user_id).execute()
        if not project.data:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Build query
        query = user_supabase.table('notes').select("*").eq('project_id', project_id)
        
        if entity_type and entity_id:
            query = query.eq('entity_type', entity_type).eq('entity_id', entity_id)
        
        response = query.order('created_at', desc=False).execute()
        
        notes = []
        for note in response.data:
            notes.append({
                "id": note['id'],
                "project_id": note['project_id'],
                "entity_type": note['entity_type'],
                "entity_id": note['entity_id'],
                "content": note['content'],
                "created_by": note['created_by'],
                "created_at": note['created_at']
            })
        
        print(f"✓ Retrieved {len(notes)} notes for {entity_type or 'project'}")
        return notes
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error fetching notes: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/notes/{note_id}")
async def delete_note(note_id: str, auth_context = Depends(get_current_user)):
    """Delete a note (only creator can delete)"""
    try:
        user = auth_context["user"]
        user_supabase = auth_context["supabase"]
        user_id = user.user.id
        
        # Verify ownership
        note = user_supabase.table('notes').select("*").eq('id', note_id).eq('created_by', user_id).execute()
        if not note.data:
            raise HTTPException(status_code=404, detail="Note not found or not authorized")
        
        # Delete note
        user_supabase.table('notes').delete().eq('id', note_id).execute()
        
        print(f"✓ Note deleted: {note_id}")
        return {"message": "Note deleted"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error deleting note: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/assistant/query", response_model=AssistantResponse)
async def query_assistant(request: AssistantRequest):
    """
    Query the Investigation Assistant powered by Ollama LLM.
    The assistant provides read-only explanations of AML findings.
    """
    try:
        print(f"\n🤖 Assistant query received: {request.question[:50]}...")
        
        # Build comprehensive system prompt with project context
        system_prompt = """You are an expert AML analyst assistant for ChainSleuth, a crypto transaction network analysis platform.

YOUR ROLE:
- Provide immediate, actionable insights about wallet risk and transaction patterns
- Explain the AML detection algorithms and why specific wallets were flagged
- Help investigators understand money laundering techniques and red flags
- Recommend focused investigation next steps
- Work with whatever context is provided - if context exists, use it directly without asking for more

AML PATTERNS YOU EXPLAIN:
Circular Transactions: Funds moving in loops back to origin (high money laundering indicator)
Layering: Funds split through multiple intermediaries to obscure source (obfuscation technique)
Structuring/Smurfing: Many small transactions to avoid detection thresholds
Pass-Through Wallets: Quick in-out movements (90%+ of inflow exits) - classic mixing pattern
Peel Chains: Sequential linear transactions with gradual value reduction
Mixer Interactions: Direct contact with known mixing/tumbling services
Fan-In/Fan-Out: Concentration/distribution patterns (aggregation/dispersal of funds)
Dormant Activation: Sudden high activity after long inactivity

RISK SCORING FACTORS:
- Intermediary behavior (3+ in AND 3+ out connections) = 60 points
- High fan-in (50+ senders) = 55 points
- Mixer interaction = 40 points
- Circular transactions = 35 points
- Layering patterns = 30 points
- High value loss (imbalanced in/out) = 15-25 points
- Each point represents a specific behavioral indicator

HOW TO RESPOND:
✓ If context provided: Analyze it directly - explain the specific patterns detected
✓ If no context: Ask the analyst to select a wallet/pattern to analyze together
✓ Always reference actual metrics from the data (amounts, wallet addresses, transaction counts)
✓ Be confident and informative - you're the expert explaining algorithmic findings
✓ Use 2-4 sentences typically, be direct and actionable

CONSTRAINTS:
✗ Cannot modify risk scores or flag new wallets (detection is automated)
✗ Cannot override the algorithm or provide financial advice
✗ Must ground all explanations in detected patterns and provided context"""

        # Build rich context if provided
        context_info = ""
        context_summary = "general investigation"
        
        if request.context:
            context_parts = []
            
            if request.context.project:
                proj = request.context.project
                context_parts.append(f"📊 Dataset: {proj.get('name', 'Unknown')} ({proj.get('dataset', 'ethereum-mainnet-q4-2024')})")
                context_parts.append(f"   Total wallets: {proj.get('walletCount', 0)} | Total transactions: {proj.get('transactionCount', 0)} | Suspicious: {proj.get('suspiciousCount', 0)}")
            
            if request.context.wallet:
                wallet = request.context.wallet
                context_parts.append(
                    f"\n👛 WALLET IN FOCUS:\n"
                    f"   Address: {wallet.get('hash', 'Unknown')}\n"
                    f"   Risk Score: {wallet.get('riskScore', 'N/A')}/100\n"
                    f"   Inflow: ${wallet.get('inflow', 0):,.2f} | Outflow: ${wallet.get('outflow', 0):,.2f}\n"
                    f"   Transactions: {wallet.get('transactionCount', 0)}"
                )
                context_summary = f"wallet {wallet.get('hash', '')[:8]}... (risk {wallet.get('riskScore', 'N/A')}/100)"
            
            if request.context.pattern:
                pattern = request.context.pattern
                context_parts.append(
                    f"\n⚠️ PATTERN DETECTED:\n"
                    f"   Type: {pattern.get('type', 'Unknown').upper()}\n"
                    f"   Wallets Involved: {pattern.get('walletCount', 1)}\n"
                    f"   Primary: {pattern.get('walletHash', 'Unknown')[:16]}..."
                )
                context_summary = f"{pattern.get('type', 'pattern').upper()} pattern"
            
            if context_parts:
                context_info = "\n\nCONTEXT FOR THIS ANALYSIS:\n" + "\n".join(context_parts)

        # Construct full prompt with context
        full_prompt = system_prompt + context_info + f"\n\n🔍 ANALYST QUESTION: {request.question}"

        # Query Ollama with optimized settings
        print("🔄 Querying Ollama (gemma3:4b model)...")
        response = ollama.generate(
            model="gemma3:4b",
            prompt=full_prompt,
            system=system_prompt,
            stream=False,
            options={
                "temperature": 0.3,  # Lower temperature for more consistent, factual responses
                "top_p": 0.8,
                "top_k": 40,
            }
        )

        assistant_response = response.get("response", "").strip()
        
        # Fallback response if empty - be proactive based on whether context exists
        if not assistant_response:
            if request.context and (request.context.wallet or request.context.pattern):
                assistant_response = f"I can help analyze the {context_summary} in your dataset. Try asking specific questions like: 'What patterns does this show?' or 'Why is the risk score high?' or 'What should I investigate first?'"
            else:
                assistant_response = "Select a wallet or pattern from the dashboard to start your investigation. I'll help explain the risk factors and detected money laundering patterns."

        print(f"✓ Assistant response generated ({len(assistant_response)} chars)")
        print(f"✓ Context: {context_summary}")
        
        return AssistantResponse(
            response=assistant_response,
            context_used=bool(request.context and any([
                request.context.project,
                request.context.wallet,
                request.context.pattern
            ]))
        )

    except Exception as e:
        print(f"❌ Error in assistant endpoint: {str(e)}")
        import traceback
        traceback.print_exc()
        # Return helpful fallback response instead of error
        return AssistantResponse(
            response="I'm ready to help analyze suspicious transactions and patterns. Select a wallet or pattern, then ask me about the risk factors or detected money laundering techniques.",
            context_used=False
        )



if __name__ == "__main__":
    import uvicorn
    print("\n🚀 Starting server on http://0.0.0.0:8000")
    print("📖 API docs available at http://localhost:8000/docs")
    print("=" * 50 + "\n")
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
