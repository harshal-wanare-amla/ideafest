import http from 'http';

const testJSON = {
  query: 'kapde blue color',
  enableRecovery: true
};

const postData = JSON.stringify(testJSON);

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/ai-search',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = http.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('\n✅ RESPONSE RECEIVED');
      console.log('Total Results:', json.total);
      console.log('Gemini Cache Status:', json.geminiCache?.status);
      console.log('Recovery Triggered:', json.recovery?.triggered);
      console.log('Recovery Strategy:', json.recovery?.strategy);
      if (json.recovery?.appliedRemovals) {
        console.log('Filters Removed:', json.recovery.appliedRemovals.join(', '));
      }
      console.log('Applied Filters:', JSON.stringify(json.appliedFilters, null, 2));
      if (json.actuallyAppliedFilters) {
        console.log('Actually Applied:', JSON.stringify(json.actuallyAppliedFilters, null, 2));
      }
    } catch (e) {
      console.error('Failed to parse response:', e);
      console.log('Raw response:', data.substring(0, 500));
    }
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
});

console.log('📤 Sending test request...');
console.log('Query:', testJSON.query);
console.log('Recovery enabled:', testJSON.enableRecovery);
req.write(postData);
req.end();
