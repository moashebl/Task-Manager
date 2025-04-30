// Check if user is authenticated
fetch('/api/auth/status')
  .then(response => response.json())
  .then(data => {
    if (!data.isAuthenticated) {
      window.location.href = 'login.html';
    } else {
      // Display username
      document.getElementById('usernameDisplay').textContent = data.username;
      // Load tasks
      loadTasks();
    }
  })
  .catch(error => {
    console.error('Error:', error);
    window.location.href = 'login.html';
  });

// Handle logout
document.getElementById('logoutBtn').addEventListener('click', async () => {
  try {
    const response = await fetch('/api/logout', {
      method: 'POST'
    });
    
    if (response.ok) {
      window.location.href = 'login.html';
    }
  } catch (error) {
    console.error('Error:', error);
  }
});

// Task filtering
const filterButtons = document.querySelectorAll('[data-filter]');
let currentFilter = 'all';

filterButtons.forEach(button => {
  button.addEventListener('click', () => {
    // Update active button
    filterButtons.forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
    
    // Update filter
    currentFilter = button.getAttribute('data-filter');
    
    // Rerender tasks
    renderTasks();
  });
});

// Add task form handler
document.getElementById('addTaskForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const title = document.getElementById('taskTitle').value;
  const description = document.getElementById('taskDescription').value;
  
  if (!title) return;
  
  try {
    const response = await fetch('/api/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, description }),
    });
    
    if (response.ok) {
      // Clear form
      document.getElementById('taskTitle').value = '';
      document.getElementById('taskDescription').value = '';
      
      // Reload tasks
      loadTasks();
    }
  } catch (error) {
    console.error('Error:', error);
  }
});

// Edit task modal handlers
const editTaskModal = {
  taskId: null,
  
  open: function(task) {
    this.taskId = task.id;
    document.getElementById('editTaskId').value = task.id;
    document.getElementById('editTaskTitle').value = task.title;
    document.getElementById('editTaskDescription').value = task.description || '';
    document.getElementById('editTaskCompleted').checked = task.completed;
    
    // Create modal instance if using vanilla JS
    const modalElement = document.getElementById('editTaskModal');
    const modal = new bootstrap.Modal(modalElement);
    modal.show();
  },
  
  save: async function() {
    const title = document.getElementById('editTaskTitle').value;
    const description = document.getElementById('editTaskDescription').value;
    const completed = document.getElementById('editTaskCompleted').checked;
    
    if (!title) return;
    
    try {
      const response = await fetch(`/api/tasks/${this.taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title, description, completed }),
      });
      
      if (response.ok) {
        // Close modal
        const modalElement = document.getElementById('editTaskModal');
        const modal = bootstrap.Modal.getInstance(modalElement);
        modal.hide();
        
        // Reload tasks
        loadTasks();
      }
    } catch (error) {
      console.error('Error:', error);
    }
  }
};

// Save edited task
document.getElementById('saveTaskBtn').addEventListener('click', () => {
  editTaskModal.save();
});

// Delete task handler
async function deleteTask(taskId) {
  if (!confirm('Are you sure you want to delete this task?')) return;
  
  try {
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: 'DELETE',
    });
    
    if (response.ok) {
      loadTasks();
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Toggle task completion
async function toggleTaskCompletion(taskId, completed) {
  try {
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ completed: !completed }),
    });
    
    if (response.ok) {
      loadTasks();
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Global tasks array
let tasks = [];

// Load tasks from server
async function loadTasks() {
  try {
    const response = await fetch('/api/tasks');
    
    if (response.ok) {
      tasks = await response.json();
      renderTasks();
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Render tasks based on filter
function renderTasks() {
  const taskList = document.getElementById('taskList');
  const emptyState = document.getElementById('emptyState');
  
  // Filter tasks
  let filteredTasks = tasks;
  if (currentFilter === 'active') {
    filteredTasks = tasks.filter(task => !task.completed);
  } else if (currentFilter === 'completed') {
    filteredTasks = tasks.filter(task => task.completed);
  }
  
  // Show empty state if no tasks
  if (filteredTasks.length === 0) {
    taskList.innerHTML = '';
    emptyState.classList.remove('d-none');
    return;
  }
  
  // Hide empty state and render tasks
  emptyState.classList.add('d-none');
  
  // Sort tasks by creation date (newest first)
  filteredTasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  // Generate HTML
  taskList.innerHTML = filteredTasks.map(task => `
    <div class="list-group-item task-item ${task.completed ? 'completed' : 'active'} d-flex justify-content-between align-items-center">
      <div class="d-flex align-items-center">
        <input class="form-check-input me-3" type="checkbox" ${task.completed ? 'checked' : ''} 
          onchange="toggleTaskCompletion('${task.id}', ${task.completed})">
        <div>
          <h6 class="mb-0 task-title">${task.title}</h6>
          ${task.description ? `<small class="text-muted">${task.description}</small>` : ''}
        </div>
      </div>
      <div class="task-actions">
        <button class="btn btn-sm btn-outline-primary me-1" onclick="editTaskModal.open(${JSON.stringify(task).replace(/"/g, "'")})" title="Edit">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteTask('${task.id}')" title="Delete">
          <i class="bi bi-trash"></i>
        </button>
      </div>
    </div>
  `).join('');
}