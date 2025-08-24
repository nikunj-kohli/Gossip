const autocannon = require('autocannon');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Load test configurations
const configs = {
  // Basic GET endpoints
  basicGetEndpoints: {
    title: 'Basic GET Endpoints',
    url: 'http://localhost:5000',
    connections: 100,
    duration: 30,
    requests: [
      {
        method: 'GET',
        path: '/api/posts',
        headers: {
          'Accept': 'application/json'
        }
      },
      {
        method: 'GET',
        path: '/api/users',
        headers: {
          'Accept': 'application/json'
        }
      },
      {
        method: 'GET',
        path: '/api/groups',
        headers: {
          'Accept': 'application/json'
        }
      }
    ]
  },
  
  // Authentication endpoints
  authEndpoints: {
    title: 'Authentication Endpoints',
    url: 'http://localhost:5000',
    connections: 50,
    duration: 20,
    requests: [
      {
        method: 'POST',
        path: '/api/auth/login',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'TestPassword123'
        })
      },
      {
        method: 'POST',
        path: '/api/auth/register',
        setupRequest: (req, context) => {
          // Generate random user for each request
          const random = Math.floor(Math.random() * 1000000);
          req.body = JSON.stringify({
            username: `user${random}`,
            email: `user${random}@example.com`,
            password: 'TestPassword123!'
          });
          return req;
        },
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    ]
  },
  
  // Post creation and interaction
  postEndpoints: {
    title: 'Post Creation and Interaction',
    url: 'http://localhost:5000',
    connections: 50,
    duration: 30,
    setupClient: (client) => {
      // Login to get token
      return new Promise((resolve) => {
        client({
          method: 'POST',
          path: '/api/auth/login',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'TestPassword123'
          }),
          onResponse: (status, body, context) => {
            if (status === 200) {
              try {
                const parsed = JSON.parse(body);
                context.token = parsed.token;
              } catch (e) {
                console.error('Failed to parse login response', e);
              }
            }
            resolve();
          }
        }, { token: null });
      });
    },
    requests: [
      {
        method: 'POST',
        path: '/api/posts',
        setupRequest: (req, context) => {
          // Add token to request
          req.headers = {
            ...req.headers,
            'Authorization': `Bearer ${context.token}`
          };
          
          // Random content for post
          const random = Math.floor(Math.random() * 1000000);
          req.body = JSON.stringify({
            content: `This is load test post #${random}`,
            visibility: 'public'
          });
          
          return req;
        },
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      },
      {
        method: 'GET',
        path: '/api/posts',
        setupRequest: (req, context) => {
          // Add token to request
          req.headers = {
            ...req.headers,
            'Authorization': `Bearer ${context.token}`
          };
          return req;
        },
        headers: {
          'Accept': 'application/json'
        }
      }
    ]
  },
  
  // Simulated mixed traffic
  mixedTraffic: {
    title: 'Mixed Traffic Simulation',
    url: 'http://localhost:5000',
    connections: 100,
    duration: 60,
    requests: [
      // 70% GET requests
      {
        method: 'GET',
        path: '/api/posts',
        weight: 40,
        headers: {
          'Accept': 'application/json'
        }
      },
      {
        method: 'GET',
        path: '/api/users',
        weight: 15,
        headers: {
          'Accept': 'application/json'
        }
      },
      {
        method: 'GET',
        path: '/api/groups',
        weight: 15,
        headers: {
          'Accept': 'application/json'
        }
      },
      // 20% POST requests
      {
        method: 'POST',
        path: '/api/auth/login',
        weight: 10,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'TestPassword123'
        })
      },
      {
        method: 'POST',
        path: '/api/posts',
        weight: 10,
        setupRequest: (req, context) => {
          // No token for simplicity in mixed traffic test
          const random = Math.floor(Math.random() * 1000000);
          req.body = JSON.stringify({
            content: `Mixed traffic test post #${random}`,
            visibility: 'public'
          });
          return req;
        },
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      },
      // 10% error-inducing requests
      {
        method: 'GET',
        path: '/api/nonexistent',
        weight: 5,
        headers: {
          'Accept': 'application/json'
        }
      },
      {
        method: 'POST',
        path: '/api/auth/login',
        weight: 5,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          email: 'invalid@example.com',
          password: 'wrong'
        })
      }
    ]
  }
};

// Run a specific load test
const runLoadTest = (configName) => {
  if (!configs[configName]) {
    console.error(`Unknown load test configuration: ${configName}`);
    process.exit(1);
  }
  
  const config = configs[configName];
  console.log(`Starting load test: ${config.title}`);
  
  const instance = autocannon(config, (err, result) => {
    if (err) {
      console.error('Load test error:', err);
      return;
    }
    
    // Save results to file
    const resultsDir = path.join(__dirname, 'results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsFile = path.join(resultsDir, `${configName}-${timestamp}.json`);
    
    fs.writeFileSync(resultsFile, JSON.stringify(result, null, 2));
    console.log(`Load test complete. Results saved to: ${resultsFile}`);
    
    // Generate HTML report
    const reportFile = path.join(resultsDir, `${configName}-${timestamp}.html`);
    exec(`autocannon-reporter ${resultsFile} --output ${reportFile}`, (error) => {
      if (error) {
        console.error('Error generating HTML report:', error);
        return;
      }
      console.log(`HTML report saved to: ${reportFile}`);
    });
  });
  
  // Track progress
  autocannon.track(instance);
  
  // Handle CTRL+C
  process.once('SIGINT', () => {
    instance.stop();
  });
};

// Run all load tests in sequence
const runAllLoadTests = async () => {
  for (const configName of Object.keys(configs)) {
    console.log(`\n=== Running load test: ${configs[configName].title} ===\n`);
    
    // Run test and wait for completion
    await new Promise((resolve) => {
      const instance = autocannon(configs[configName], (err, result) => {
        if (err) {
          console.error('Load test error:', err);
        } else {
          // Save results to file
          const resultsDir = path.join(__dirname, 'results');
          if (!fs.existsSync(resultsDir)) {
            fs.mkdirSync(resultsDir, { recursive: true });
          }
          
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const resultsFile = path.join(resultsDir, `${configName}-${timestamp}.json`);
          
          fs.writeFileSync(resultsFile, JSON.stringify(result, null, 2));
          console.log(`Load test complete. Results saved to: ${resultsFile}`);
        }
        resolve();
      });
      
      // Track progress
      autocannon.track(instance);
    });
    
    // Short delay between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\nAll load tests completed.');
};

// If called directly from command line
if (require.main === module) {
  const arg = process.argv[2];
  
  if (arg === 'all') {
    runAllLoadTests();
  } else if (arg && configs[arg]) {
    runLoadTest(arg);
  } else {
    console.log('Available load test configurations:');
    Object.keys(configs).forEach(name => {
      console.log(`- ${name}: ${configs[name].title}`);
    });
    console.log('\nUsage: node loadtest.js [configName|all]');
  }
}

module.exports = {
  configs,
  runLoadTest,
  runAllLoadTests
};