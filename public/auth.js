// Check if user is already logged in
fetch('/api/auth/status')
  .then(response => response.json())
  .then(data => {
    if (data.isAuthenticated) {
      window.location.href = 'dashboard.html';
    }
  })
  .catch(error => console.error('Error:', error));

// Register form handler
const registerForm = document.getElementById('registerForm');
if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('errorMessage');
    
    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        errorMessage.textContent = data.error || 'Registration failed';
        errorMessage.classList.remove('d-none');
        return;
      }
      
      // Redirect to login page on successful registration
      window.location.href = 'login.html?registered=true';
    } catch (error) {
      console.error('Error:', error);
      errorMessage.textContent = 'An error occurred. Please try again.';
      errorMessage.classList.remove('d-none');
    }
  });
}

// Login form handler
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('errorMessage');
    
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        errorMessage.textContent = data.error || 'Login failed';
        errorMessage.classList.remove('d-none');
        return;
      }
      
      // Redirect to dashboard on successful login
      window.location.href = 'dashboard.html';
    } catch (error) {
      console.error('Error:', error);
      errorMessage.textContent = 'An error occurred. Please try again.';
      errorMessage.classList.remove('d-none');
    }
  });
}