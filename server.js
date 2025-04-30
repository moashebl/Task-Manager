const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

// Create users.json if it doesn't exist
const usersPath = path.join(dataDir, 'users.json');
if (!fs.existsSync(usersPath)) {
  fs.writeFileSync(usersPath, JSON.stringify([]));
}

// Create tasks.json if it doesn't exist
const tasksPath = path.join(dataDir, 'tasks.json');
if (!fs.existsSync(tasksPath)) {
  fs.writeFileSync(tasksPath, JSON.stringify([]));
}

// Helper functions
function readDataFile(filename) {
  const filePath = path.join(dataDir, filename);
  const data = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(data);
}

function writeDataFile(filename, data) {
  const filePath = path.join(dataDir, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// Parse cookies from request
function parseCookies(request) {
  const cookieHeader = request.headers.cookie || '';
  const cookies = {};
  
  cookieHeader.split(';').forEach(cookie => {
    const [name, value] = cookie.trim().split('=');
    if (name) cookies[name] = decodeURIComponent(value);
  });
  
  return cookies;
}

// Parse JSON body from request
function parseBody(request) {
  return new Promise((resolve, reject) => {
    if (request.method === 'GET' || request.method === 'DELETE') {
      return resolve({});
    }
    
    let body = '';
    request.on('data', chunk => {
      body += chunk.toString();
    });
    
    request.on('end', () => {
      try {
        const data = body ? JSON.parse(body) : {};
        resolve(data);
      } catch (err) {
        reject(err);
      }
    });
    
    request.on('error', err => {
      reject(err);
    });
  });
}

// Authenticate user
function authenticate(request) {
  const cookies = parseCookies(request);
  const username = cookies.username;
  
  if (!username) {
    return null;
  }
  
  const users = readDataFile('users.json');
  return users.find(u => u.username === username);
}

// Set cookie in response
function setCookie(response, name, value, options = {}) {
  const cookieOptions = [];
  
  if (options.maxAge) {
    cookieOptions.push(`Max-Age=${options.maxAge}`);
  }
  
  if (options.httpOnly) {
    cookieOptions.push('HttpOnly');
  }
  
  if (options.path) {
    cookieOptions.push(`Path=${options.path}`);
  }
  
  const optionsString = cookieOptions.length > 0 ? `; ${cookieOptions.join('; ')}` : '';
  response.setHeader('Set-Cookie', `${name}=${value}${optionsString}`);
}

// Clear cookie in response
function clearCookie(response, name) {
  response.setHeader('Set-Cookie', `${name}=; Max-Age=0`);
}

// Serve static files
function serveStaticFile(request, response) {
  const parsedUrl = url.parse(request.url, true);
  const pathname = parsedUrl.pathname;
  let filePath = path.join(__dirname, 'public', pathname === '/' ? 'index.html' : pathname);
  
  // Handle directory requests
  if (!path.extname(filePath)) {
    filePath = path.join(filePath, 'index.html');
  }
  
  const contentTypeMap = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
  };
  
  const extname = path.extname(filePath);
  const contentType = contentTypeMap[extname] || 'text/plain';
  
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // File not found
        response.writeHead(404);
        response.end('File not found');
      } else {
        // Server error
        response.writeHead(500);
        response.end(`Server Error: ${err.code}`);
      }
    } else {
      // Success
      response.writeHead(200, { 'Content-Type': contentType });
      response.end(content);
    }
  });
}

// Send JSON response
function sendJsonResponse(response, statusCode, data) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(data));
}

// Handle API requests
async function handleApiRequest(request, response, pathname) {
  try {
    // Parse the endpoint from pathname
    const endpoint = pathname.substring(1); // Remove leading '/'
    
    // Handle user registration
    if (endpoint === 'register' && request.method === 'POST') {
      const body = await parseBody(request);
      const { username, password } = body;
      
      if (!username || !password) {
        return sendJsonResponse(response, 400, { error: 'Username and password are required' });
      }
      
      const users = readDataFile('users.json');
      
      if (users.some(u => u.username === username)) {
        return sendJsonResponse(response, 400, { error: 'Username already taken' });
      }
      
      users.push({ username, password });
      writeDataFile('users.json', users);
      
      return sendJsonResponse(response, 201, { message: 'User registered successfully' });
    }
    
    // Handle user login
    if (endpoint === 'login' && request.method === 'POST') {
      const body = await parseBody(request);
      const { username, password } = body;
      
      if (!username || !password) {
        return sendJsonResponse(response, 400, { error: 'Username and password are required' });
      }
      
      const users = readDataFile('users.json');
      const user = users.find(u => u.username === username && u.password === password);
      
      if (!user) {
        return sendJsonResponse(response, 401, { error: 'Invalid username or password' });
      }
      
      // Set cookie for authentication
      setCookie(response, 'username', username, { maxAge: 86400 }); // 24 hours
      
      return sendJsonResponse(response, 200, { message: 'Login successful' });
    }
    
    // Handle user logout
    if (endpoint === 'logout' && request.method === 'POST') {
      clearCookie(response, 'username');
      return sendJsonResponse(response, 200, { message: 'Logout successful' });
    }
    
    // Check authentication status
    if (endpoint === 'auth/status') {
      const user = authenticate(request);
      
      if (!user) {
        return sendJsonResponse(response, 200, { isAuthenticated: false });
      }
      
      return sendJsonResponse(response, 200, {
        isAuthenticated: true,
        username: user.username
      });
    }
    
    // Get tasks
    if (endpoint === 'tasks' && request.method === 'GET') {
      const user = authenticate(request);
      
      if (!user) {
        return sendJsonResponse(response, 401, { error: 'Unauthorized' });
      }
      
      const tasks = readDataFile('tasks.json');
      const userTasks = tasks.filter(task => task.username === user.username);
      
      return sendJsonResponse(response, 200, userTasks);
    }
    
    // Add task
    if (endpoint === 'tasks' && request.method === 'POST') {
      const user = authenticate(request);
      
      if (!user) {
        return sendJsonResponse(response, 401, { error: 'Unauthorized' });
      }
      
      const body = await parseBody(request);
      const { title, description } = body;
      
      if (!title) {
        return sendJsonResponse(response, 400, { error: 'Task title is required' });
      }
      
      const tasks = readDataFile('tasks.json');
      
      const newTask = {
        id: Date.now().toString(),
        username: user.username,
        title,
        description: description || '',
        completed: false,
        createdAt: new Date().toISOString()
      };
      
      tasks.push(newTask);
      writeDataFile('tasks.json', tasks);
      
      return sendJsonResponse(response, 201, newTask);
    }
    
    // Update task
    if (/^tasks\/(.+)$/.test(endpoint) && request.method === 'PUT') {
      const user = authenticate(request);
      
      if (!user) {
        return sendJsonResponse(response, 401, { error: 'Unauthorized' });
      }
      
      const taskId = endpoint.split('/')[1];
      const body = await parseBody(request);
      const { title, description, completed } = body;
      
      const tasks = readDataFile('tasks.json');
      const taskIndex = tasks.findIndex(t => t.id === taskId && t.username === user.username);
      
      if (taskIndex === -1) {
        return sendJsonResponse(response, 404, { error: 'Task not found' });
      }
      
      const updatedTask = {
        ...tasks[taskIndex],
        title: title !== undefined ? title : tasks[taskIndex].title,
        description: description !== undefined ? description : tasks[taskIndex].description,
        completed: completed !== undefined ? completed : tasks[taskIndex].completed
      };
      
      tasks[taskIndex] = updatedTask;
      writeDataFile('tasks.json', tasks);
      
      return sendJsonResponse(response, 200, updatedTask);
    }
    
    // Delete task
    if (/^tasks\/(.+)$/.test(endpoint) && request.method === 'DELETE') {
      const user = authenticate(request);
      
      if (!user) {
        return sendJsonResponse(response, 401, { error: 'Unauthorized' });
      }
      
      const taskId = endpoint.split('/')[1];
      
      const tasks = readDataFile('tasks.json');
      const taskIndex = tasks.findIndex(t => t.id === taskId && t.username === user.username);
      
      if (taskIndex === -1) {
        return sendJsonResponse(response, 404, { error: 'Task not found' });
      }
      
      tasks.splice(taskIndex, 1);
      writeDataFile('tasks.json', tasks);
      
      return sendJsonResponse(response, 200, { message: 'Task deleted successfully' });
    }
    
    // API endpoint not found
    return sendJsonResponse(response, 404, { error: 'API endpoint not found' });
  } catch (error) {
    console.error('Error handling API request:', error);
    return sendJsonResponse(response, 500, { error: 'Internal server error' });
  }
}

// Create server
const server = http.createServer(async (request, response) => {
  const parsedUrl = url.parse(request.url, true);
  const pathname = parsedUrl.pathname;
  
  // Handle API requests
  if (pathname.startsWith('/api/')) {
    return await handleApiRequest(request, response, pathname.substring(4));
  }
  
  // Handle static files
  serveStaticFile(request, response);
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});