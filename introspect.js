import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

// Get token from server memory by calling the internal gql function approach
// Instead, add a temp introspection endpoint
// Actually, let's just make a direct call using the running server's token

// Approach: hit the running server which has a valid token
// We'll add a temporary introspection API
const BASE = 'http://localhost:3001';

// First verify we're authenticated
const authRes = await fetch(`${BASE}/api/auth/status`);
const authData = await authRes.json();
console.log('Authenticated:', authData.authenticated);

if (!authData.authenticated) {
  console.log('Not authenticated, cannot introspect');
  process.exit(1);
}

// We need to add introspection to the server, or use a workaround
// Let's modify the approach: create a script that imports and reuses the token
