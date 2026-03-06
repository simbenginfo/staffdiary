const API_URL = "https://script.google.com/macros/s/AKfycbzBcnBKlBKcUqEVNqONC4ZQvUYWuGO0oPCIkQA0zHmh-CHg9ASYlTO0eoDa4S1mfvCa/exec";

// State
let currentUser = null;
let currentRole = null;
let staffList = [];
let lessons = [];
let currentStaffViewId = null;
let currentClassFilter = 'All';
let lessonToDelete = null;

// DOM Elements
const views = {
    login: document.getElementById('login-view'),
    admin: document.getElementById('admin-view'),
    staff: document.getElementById('staff-view')
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('year').textContent = new Date().getFullYear();
    
    // Check local storage
    const storedUser = localStorage.getItem('omega_user');
    if (storedUser) {
        const user = JSON.parse(storedUser);
        currentUser = user.id;
        currentRole = user.role;
        showView(currentRole === 'admin' ? 'admin' : 'staff');
        initDashboard();
    }

    setupEventListeners();
});

function setupEventListeners() {
    // Login
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    
    // Logout
    document.querySelectorAll('.logout-btn').forEach(btn => {
        btn.addEventListener('click', handleLogout);
    });

    // Mobile Menus
    const toggleSidebar = (viewId) => {
        const sidebar = document.querySelector(`#${viewId} .w-64`);
        const overlay = document.getElementById('sidebar-overlay');
        
        if (sidebar.classList.contains('hidden')) {
            sidebar.classList.remove('hidden', 'md:flex');
            sidebar.classList.add('fixed', 'inset-y-0', 'left-0', 'z-40', 'flex', 'w-72', 'shadow-2xl', 'animate-in', 'slide-in-from-left', 'duration-300');
            overlay.classList.remove('hidden');
        } else {
            sidebar.classList.add('hidden', 'md:flex');
            sidebar.classList.remove('fixed', 'inset-y-0', 'left-0', 'z-40', 'flex', 'w-72', 'shadow-2xl', 'animate-in', 'slide-in-from-left', 'duration-300');
            overlay.classList.add('hidden');
        }
    };

    document.getElementById('mobile-admin-menu').addEventListener('click', () => toggleSidebar('admin-view'));
    document.getElementById('mobile-staff-menu').addEventListener('click', () => toggleSidebar('staff-view'));
    document.getElementById('sidebar-overlay').addEventListener('click', () => {
        if (!views.admin.classList.contains('hidden')) toggleSidebar('admin-view');
        if (!views.staff.classList.contains('hidden')) toggleSidebar('staff-view');
    });

    // Admin Navigation
    document.querySelectorAll('#admin-view .nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Close mobile sidebar if open
            const sidebar = document.querySelector('#admin-view .w-64');
            if (sidebar.classList.contains('fixed')) toggleSidebar('admin-view');

            document.querySelectorAll('#admin-view .nav-item').forEach(n => {
                n.classList.remove('active', 'bg-slate-800');
            });
            item.classList.add('active', 'bg-slate-800');
            
            const target = item.getAttribute('data-target');
            document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
            document.getElementById(target).classList.add('active');
            
            if (target === 'admin-staff-list') {
                document.getElementById('admin-page-title').textContent = 'Staff Members';
                currentStaffViewId = null;
                loadStaffList();
            } else if (target === 'admin-my-lessons') {
                document.getElementById('admin-page-title').textContent = 'My Lessons';
                currentStaffViewId = null;
                loadAdminMyLessons();
            } else if (target === 'admin-add-staff') {
                document.getElementById('admin-page-title').textContent = 'Add New Staff';
                currentStaffViewId = null;
            }
        });
    });

    document.getElementById('admin-add-lesson-btn').addEventListener('click', () => openLessonModal());
    document.getElementById('admin-my-search-lessons').addEventListener('input', (e) => {
        renderAdminMyLessons(e.target.value);
    });
    document.getElementById('admin-my-export-pdf').addEventListener('click', () => exportLessonsToPDF(currentUser));
    
    // Admin Actions
    document.getElementById('add-staff-form').addEventListener('submit', handleAddStaff);
    document.getElementById('back-to-staff-btn').addEventListener('click', () => {
        document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
        document.getElementById('admin-staff-list').classList.add('active');
        document.getElementById('admin-page-title').textContent = 'Staff Members';
    });
    document.getElementById('admin-search-lessons').addEventListener('input', (e) => {
        renderAdminLessons(e.target.value);
    });
    document.getElementById('export-all-lessons-btn').addEventListener('click', () => exportAllStaffLessons(currentUser));
    document.getElementById('admin-export-staff-pdf').addEventListener('click', () => exportLessonsToPDF(currentStaffViewId));

    // Staff Navigation
    document.querySelectorAll('.staff-nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const target = item.getAttribute('data-target');
            document.querySelectorAll('.staff-section').forEach(s => s.classList.remove('active'));
            document.getElementById(target).classList.add('active');
            document.getElementById('staff-page-title').textContent = 'Change Password';
        });
    });

    // Staff Actions
    document.getElementById('staff-add-lesson-btn').addEventListener('click', () => openLessonModal());
    document.getElementById('close-lesson-modal').addEventListener('click', closeLessonModal);
    document.getElementById('lesson-form').addEventListener('submit', handleSaveLesson);
    document.getElementById('staff-search-lessons').addEventListener('input', (e) => {
        renderStaffLessons(e.target.value);
    });
    document.getElementById('staff-export-pdf').addEventListener('click', () => exportLessonsToPDF(currentUser));
    document.getElementById('change-password-form').addEventListener('submit', handleChangePassword);

    // Delete Modal
    document.getElementById('cancel-delete').addEventListener('click', closeDeleteModal);
    document.getElementById('confirm-delete').addEventListener('click', confirmDeleteLesson);
}

function showView(viewName) {
    Object.values(views).forEach(v => {
        v.classList.remove('active');
        setTimeout(() => v.style.display = 'none', 300);
    });
    
    setTimeout(() => {
        views[viewName].style.display = 'flex';
        // trigger reflow
        void views[viewName].offsetWidth;
        views[viewName].classList.add('active');
    }, 300);
}

function initDashboard() {
    if (currentRole === 'admin') {
        loadStaffList();
    } else {
        document.getElementById('staff-sidebar-name').textContent = `Staff ID: ${currentUser}`;
        loadStaffLessons();
    }
}

// --- API Wrapper ---
async function apiCall(action, payload) {
    // Mock implementation for UI preview if API_URL is not set
    if (API_URL === "PASTE_APPS_SCRIPT_WEBAPP_URL") {
        return mockApiCall(action, payload);
    }

    try {
        // Add a timestamp to the URL to prevent caching issues
        const cacheBusterUrl = `${API_URL}?t=${Date.now()}`;
        
        const response = await fetch(cacheBusterUrl, {
            method: "POST",
            mode: "cors",
            headers: {
                "Content-Type": "text/plain;charset=utf-8"
            },
            body: JSON.stringify({ action: action, data: payload }),
            redirect: "follow"
        });
        
        if (!response.ok) {
            throw new Error(`Server responded with status: ${response.status}`);
        }

        const text = await response.text();
        let result;
        try {
            result = JSON.parse(text);
        } catch (e) {
            console.error("Failed to parse JSON response:", text);
            return { status: "error", message: "Invalid response from server. Check your Google Script deployment." };
        }
        return result;
    } catch (error) {
        console.error("Detailed API Error:", error);
        // Provide a more helpful error for the UI
        return { status: "error", message: "Connection failed. Please ensure the Google Script is deployed as 'Anyone' and check your internet connection." };
    }
}

// --- Login Logic ---
async function handleLogin(e) {
    e.preventDefault();
    const id = document.getElementById('userid').value;
    const pass = document.getElementById('password').value;
    const btn = e.target.querySelector('button');
    const errorDiv = document.getElementById('login-error');
    
    btn.innerHTML = '<div class="loader"></div>';
    errorDiv.classList.add('hidden');

    try {
        const res = await apiCall('login', { id: id, password: pass });
        if (res.status === "success") {
            currentUser = id;
            currentRole = res.data.role;
            localStorage.setItem('omega_user', JSON.stringify({ id, role: currentRole }));
            showView(currentRole === 'admin' ? 'admin' : 'staff');
            initDashboard();
        } else {
            errorDiv.textContent = res.message || "Invalid credentials";
            errorDiv.classList.remove('hidden');
        }
    } catch (err) {
        errorDiv.textContent = "Connection error. Please try again.";
        errorDiv.classList.remove('hidden');
    } finally {
        btn.innerHTML = 'Sign In';
    }
}

function handleLogout() {
    localStorage.removeItem('omega_user');
    currentUser = null;
    currentRole = null;
    document.getElementById('login-form').reset();
    showView('login');
}

// --- Admin Logic ---
async function loadStaffList() {
    const container = document.getElementById('staff-cards-container');
    container.innerHTML = '<div class="col-span-full text-center py-10"><div class="loader border-accent"></div></div>';
    
    try {
        const res = await apiCall('getStaffList', {});
        if (res.status === "success") {
            staffList = res.data;
            renderStaffList();
        }
    } catch (err) {
        container.innerHTML = '<div class="col-span-full text-red-400">Failed to load staff list.</div>';
    }
}

function renderStaffList() {
    const container = document.getElementById('staff-cards-container');
    container.innerHTML = '';
    
    if (staffList.length === 0) {
        container.innerHTML = '<div class="col-span-full text-slate-400">No staff members found.</div>';
        return;
    }

    staffList.forEach(staff => {
        const card = document.createElement('div');
        card.className = 'bg-card p-6 rounded-xl border border-slate-700 hover:border-accent transition-colors shadow-lg flex flex-col';
        card.innerHTML = `
            <div class="flex items-center space-x-4 mb-4">
                <div class="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-xl font-bold text-accent">
                    ${staff.name.charAt(0).toUpperCase()}
                </div>
                <div>
                    <h4 class="font-bold text-lg text-white">${staff.name}</h4>
                    <p class="text-sm text-slate-400">ID: ${staff.id}</p>
                </div>
            </div>
            <button class="mt-auto w-full bg-slate-800 hover:bg-slate-700 text-white py-2 rounded-lg transition-colors flex items-center justify-center space-x-2" onclick="viewStaffLessons('${staff.id}', '${staff.name}')">
                <i class="fas fa-book-open text-accent"></i>
                <span>Open Lessons</span>
            </button>
        `;
        container.appendChild(card);
    });
}

// Make viewStaffLessons globally available
window.viewStaffLessons = async function(staffId, staffName) {
    currentStaffViewId = staffId;
    document.getElementById('viewing-staff-name').textContent = `${staffName}'s Lessons`;
    
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    document.getElementById('admin-staff-lessons').classList.add('active');
    
    const tbody = document.getElementById('admin-lessons-tbody');
    tbody.innerHTML = '<tr><td colspan="3" class="text-center py-8"><div class="loader border-accent"></div></td></tr>';
    
    try {
        const res = await apiCall('getLessons', { userId: staffId });
        if (res.status === "success") {
            lessons = res.data;
            renderAdminLessons();
        }
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center py-8 text-red-400">Failed to load lessons.</td></tr>';
    }
};

function renderAdminLessons(searchText = '') {
    const tbody = document.getElementById('admin-lessons-tbody');
    tbody.innerHTML = '';
    
    const filtered = lessons.filter(l => {
        const search = searchText.toLowerCase();
        const dateStr = l.date ? l.date.toString().toLowerCase() : '';
        const classStr = l.class ? l.class.toString().toLowerCase() : '';
        const lessonStr = l.lesson ? l.lesson.toString().toLowerCase() : '';
        
        return dateStr.includes(search) || 
               classStr.includes(search) || 
               lessonStr.includes(search);
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center py-8 text-slate-400">No lessons found.</td></tr>';
        return;
    }

    filtered.forEach(l => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-800/50 transition-colors group';
        const dateDisplay = l.date ? (typeof l.date === 'string' ? l.date : new Date(l.date).toLocaleDateString()) : '';
        tr.innerHTML = `
            <td class="p-4 whitespace-nowrap text-slate-300">${dateDisplay}</td>
            <td class="p-4 whitespace-nowrap"><span class="bg-slate-800 px-3 py-1 rounded-full text-sm border border-slate-700 text-slate-200">${l.class || ''}</span></td>
            <td class="p-4 text-slate-300"><div class="line-clamp-2 group-hover:line-clamp-none transition-all">${l.lesson || ''}</div></td>
            <td class="p-4 whitespace-nowrap text-right">
                <button class="text-slate-400 hover:text-accent p-2 transition-colors" onclick="editLesson('${l.row}')" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="text-slate-400 hover:text-red-400 p-2 transition-colors" onclick="promptDeleteLesson('${l.row}')" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function handleAddStaff(e) {
    e.preventDefault();
    const id = document.getElementById('new-staff-id').value;
    const name = document.getElementById('new-staff-name').value;
    const pass = document.getElementById('new-staff-password').value;
    const msg = document.getElementById('add-staff-message');
    const btn = e.target.querySelector('button');
    
    btn.innerHTML = '<div class="loader"></div>';
    msg.classList.add('hidden');

    try {
        const res = await apiCall('createStaff', { adminId: currentUser, staffId: id, name, password: pass });
        if (res.status === "success") {
            msg.textContent = "Staff created successfully!";
            msg.className = "text-sm text-green-400 block";
            e.target.reset();
            loadStaffList(); // refresh list in background
        } else {
            msg.textContent = res.message || "Failed to create staff.";
            msg.className = "text-sm text-red-400 block";
        }
    } catch (err) {
        msg.textContent = "Connection error.";
        msg.className = "text-sm text-red-400 block";
    } finally {
        btn.innerHTML = 'Create Staff';
    }
}

async function loadAdminMyLessons() {
    const tbody = document.getElementById('admin-my-lessons-tbody');
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8"><div class="loader border-accent"></div></td></tr>';
    
    try {
        const res = await apiCall('getLessons', { userId: currentUser });
        if (res.status === "success") {
            lessons = res.data;
            renderAdminMyLessons();
        }
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-red-400">Failed to load lessons.</td></tr>';
    }
}

function renderAdminMyLessons(searchText = '') {
    const tbody = document.getElementById('admin-my-lessons-tbody');
    tbody.innerHTML = '';
    
    const filtered = lessons.filter(l => {
        const search = searchText.toLowerCase();
        
        const dateStr = l.date ? l.date.toString().toLowerCase() : '';
        const classStr = l.class ? l.class.toString().toLowerCase() : '';
        const lessonStr = l.lesson ? l.lesson.toString().toLowerCase() : '';
        
        return dateStr.includes(search) || 
               classStr.includes(search) || 
               lessonStr.includes(search);
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-slate-400">No lessons found.</td></tr>';
        return;
    }

    filtered.forEach(l => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-800/50 transition-colors group';
        const dateDisplay = l.date ? (typeof l.date === 'string' ? l.date : new Date(l.date).toLocaleDateString()) : '';
        tr.innerHTML = `
            <td class="p-4 whitespace-nowrap text-slate-300">${dateDisplay}</td>
            <td class="p-4 whitespace-nowrap"><span class="bg-slate-800 px-3 py-1 rounded-full text-sm border border-slate-700 text-slate-200">${l.class || ''}</span></td>
            <td class="p-4 text-slate-300"><div class="line-clamp-2 group-hover:line-clamp-none transition-all">${l.lesson || ''}</div></td>
            <td class="p-4 whitespace-nowrap text-right">
                <button class="text-slate-400 hover:text-accent p-2 transition-colors" onclick="editLesson('${l.row}')" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="text-slate-400 hover:text-red-400 p-2 transition-colors" onclick="promptDeleteLesson('${l.row}')" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// --- Staff Logic ---
async function loadStaffLessons() {
    const tbody = document.getElementById('staff-lessons-tbody');
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8"><div class="loader border-accent"></div></td></tr>';
    
    try {
        const res = await apiCall('getLessons', { userId: currentUser });
        if (res.status === "success") {
            lessons = res.data;
            updateClassesSidebar();
            renderStaffLessons();
        }
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-red-400">Failed to load lessons.</td></tr>';
    }
}

function updateClassesSidebar() {
    const classes = [...new Set(lessons.map(l => l.class))].filter(Boolean).sort();
    const nav = document.getElementById('staff-classes-list');
    
    let html = `
        <a href="#" class="class-filter flex items-center justify-between p-2 rounded-lg transition-colors ${currentClassFilter === 'All' ? 'bg-accent/20 text-accent' : 'hover:bg-slate-800 text-slate-300'}" data-class="All">
            <div class="flex items-center space-x-3">
                <i class="fas fa-layer-group w-5"></i>
                <span>All Classes</span>
            </div>
            <span class="bg-slate-800 text-xs py-1 px-2 rounded-full text-slate-300">${lessons.length}</span>
        </a>
    `;
    
    classes.forEach(c => {
        const count = lessons.filter(l => l.class === c).length;
        html += `
            <a href="#" class="class-filter flex items-center justify-between p-2 rounded-lg transition-colors ${currentClassFilter === c ? 'bg-accent/20 text-accent' : 'hover:bg-slate-800 text-slate-300'}" data-class="${c}">
                <div class="flex items-center space-x-3">
                    <i class="fas fa-chalkboard w-5"></i>
                    <span>${c}</span>
                </div>
                <span class="bg-slate-800 text-xs py-1 px-2 rounded-full text-slate-300">${count}</span>
            </a>
        `;
    });
    
    nav.innerHTML = html;
    
    nav.querySelectorAll('.class-filter').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            currentClassFilter = item.getAttribute('data-class');
            
            document.querySelectorAll('.staff-section').forEach(s => s.classList.remove('active'));
            document.getElementById('staff-lessons-section').classList.add('active');
            
            document.getElementById('staff-page-title').textContent = currentClassFilter === 'All' ? 'All Lessons' : `Lessons: ${currentClassFilter}`;
            
            updateClassesSidebar(); // update active state
            renderStaffLessons(document.getElementById('staff-search-lessons').value);
        });
    });
}

function renderStaffLessons(searchText = '') {
    const tbody = document.getElementById('staff-lessons-tbody');
    tbody.innerHTML = '';
    
    const filtered = lessons.filter(l => {
        const matchClass = currentClassFilter === 'All' || l.class === currentClassFilter;
        const search = searchText.toLowerCase();
        
        const dateStr = l.date ? l.date.toString().toLowerCase() : '';
        const classStr = l.class ? l.class.toString().toLowerCase() : '';
        const lessonStr = l.lesson ? l.lesson.toString().toLowerCase() : '';

        const matchSearch = dateStr.includes(search) || 
                            classStr.includes(search) || 
                            lessonStr.includes(search);
        return matchClass && matchSearch;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-slate-400">No lessons found.</td></tr>';
        return;
    }

    filtered.forEach(l => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-800/50 transition-colors group';
        const dateDisplay = l.date ? (typeof l.date === 'string' ? l.date : new Date(l.date).toLocaleDateString()) : '';
        tr.innerHTML = `
            <td class="p-4 whitespace-nowrap text-slate-300">${dateDisplay}</td>
            <td class="p-4 whitespace-nowrap"><span class="bg-slate-800 px-3 py-1 rounded-full text-sm border border-slate-700 text-slate-200">${l.class || ''}</span></td>
            <td class="p-4 text-slate-300"><div class="line-clamp-2 group-hover:line-clamp-none transition-all">${l.lesson || ''}</div></td>
            <td class="p-4 whitespace-nowrap text-right">
                <button class="text-slate-400 hover:text-accent p-2 transition-colors" onclick="editLesson('${l.row}')" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="text-slate-400 hover:text-red-400 p-2 transition-colors" onclick="promptDeleteLesson('${l.row}')" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.editLesson = function(row) {
    const lesson = lessons.find(l => l.row.toString() === row.toString());
    if (lesson) {
        openLessonModal(lesson);
    }
};

window.promptDeleteLesson = function(row) {
    lessonToDelete = row;
    const modal = document.getElementById('delete-modal');
    modal.classList.remove('hidden');
    void modal.offsetWidth;
    modal.classList.add('show');
};

function openLessonModal(lesson = null) {
    const modal = document.getElementById('lesson-modal');
    const form = document.getElementById('lesson-form');
    const title = document.getElementById('lesson-modal-title');
    
    form.reset();
    
    if (lesson) {
        title.textContent = 'Edit Lesson';
        document.getElementById('lesson-row-id').value = lesson.row;
        
        // Format date for input[type=date]
        let dateVal = '';
        if (lesson.date) {
            const d = new Date(lesson.date);
            if (!isNaN(d.getTime())) {
                dateVal = d.toISOString().split('T')[0];
            } else {
                dateVal = lesson.date;
            }
        }
        document.getElementById('lesson-date').value = dateVal;
        document.getElementById('lesson-class').value = lesson.class || '';
        document.getElementById('lesson-details').value = lesson.lesson || '';
    } else {
        title.textContent = 'Add Lesson';
        document.getElementById('lesson-row-id').value = '';
        document.getElementById('lesson-date').value = new Date().toISOString().split('T')[0];
        if (currentClassFilter !== 'All') {
            document.getElementById('lesson-class').value = currentClassFilter;
        }
    }
    
    modal.classList.remove('hidden');
    // trigger reflow
    void modal.offsetWidth;
    modal.classList.add('show');
}

function closeLessonModal() {
    const modal = document.getElementById('lesson-modal');
    modal.classList.remove('show');
    setTimeout(() => modal.classList.add('hidden'), 300);
}

async function handleSaveLesson(e) {
    e.preventDefault();
    const row = document.getElementById('lesson-row-id').value;
    const date = document.getElementById('lesson-date').value;
    const className = document.getElementById('lesson-class').value;
    const details = document.getElementById('lesson-details').value;
    const btn = e.target.querySelector('button');
    
    const originalText = btn.innerHTML;
    btn.innerHTML = '<div class="loader"></div>';

    try {
        let res;
        const targetUserId = (currentRole === 'admin' && currentStaffViewId) ? currentStaffViewId : currentUser;
        
        if (row) {
            res = await apiCall('updateLesson', { userId: targetUserId, row, date, className, lessonDetails: details });
        } else {
            res = await apiCall('addLesson', { userId: targetUserId, date, className, lessonDetails: details });
        }
        
        if (res.status === "success") {
            closeLessonModal();
            if (currentRole === 'admin') {
                const activeSection = document.querySelector('.admin-section.active');
                if (activeSection && activeSection.id === 'admin-my-lessons') {
                    loadAdminMyLessons();
                } else if (activeSection && activeSection.id === 'admin-staff-lessons') {
                    // Refresh current staff view
                    const staffName = document.getElementById('viewing-staff-name').textContent.split("'")[0];
                    viewStaffLessons(currentStaffViewId, staffName);
                }
            } else {
                loadStaffLessons();
            }
        } else {
            alert(res.message || "Failed to save lesson");
        }
    } catch (err) {
        alert("Connection error.");
    } finally {
        btn.innerHTML = originalText;
    }
}

function closeDeleteModal() {
    lessonToDelete = null;
    const modal = document.getElementById('delete-modal');
    modal.classList.remove('show');
    setTimeout(() => modal.classList.add('hidden'), 300);
}

async function confirmDeleteLesson() {
    if (!lessonToDelete) return;
    
    const btn = document.getElementById('confirm-delete');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<div class="loader"></div>';

    try {
        const targetUserId = (currentRole === 'admin' && currentStaffViewId) ? currentStaffViewId : currentUser;
        const res = await apiCall('deleteLesson', { userId: targetUserId, row: lessonToDelete });
        if (res.status === "success") {
            closeDeleteModal();
            if (currentRole === 'admin') {
                const activeSection = document.querySelector('.admin-section.active');
                if (activeSection && activeSection.id === 'admin-my-lessons') {
                    loadAdminMyLessons();
                } else if (activeSection && activeSection.id === 'admin-staff-lessons') {
                    const staffName = document.getElementById('viewing-staff-name').textContent.split("'")[0];
                    viewStaffLessons(currentStaffViewId, staffName);
                }
            } else {
                loadStaffLessons();
            }
        } else {
            alert(res.message || "Failed to delete lesson");
        }
    } catch (err) {
        alert("Connection error.");
    } finally {
        btn.innerHTML = originalText;
    }
}

async function handleChangePassword(e) {
    e.preventDefault();
    const oldPass = document.getElementById('old-password').value;
    const newPass = document.getElementById('new-password').value;
    const msg = document.getElementById('change-password-message');
    const btn = e.target.querySelector('button');
    
    btn.innerHTML = '<div class="loader"></div>';
    msg.classList.add('hidden');

    try {
        const res = await apiCall('changePassword', { userId: currentUser, oldPass, newPass });
        if (res.status === "success") {
            msg.textContent = "Password updated successfully!";
            msg.className = "text-sm text-green-400 block";
            e.target.reset();
        } else {
            msg.textContent = res.message || "Failed to update password.";
            msg.className = "text-sm text-red-400 block";
        }
    } catch (err) {
        msg.textContent = "Connection error.";
        msg.className = "text-sm text-red-400 block";
    } finally {
        btn.innerHTML = 'Update Password';
    }
}

// --- Exports ---
async function exportLessonsToPDF(staffId) {
    try {
        const res = await apiCall('exportPDF', { userId: staffId });
        if (res.status === "success" && res.data) {
            window.open(res.data, '_blank');
        } else {
            alert("Failed to generate PDF");
        }
    } catch (err) {
        alert("Connection error during export.");
    }
}

async function exportAllStaffLessons(adminId) {
    try {
        const res = await apiCall('exportAllPDF', { adminId });
        if (res.status === "success" && res.data) {
            window.open(res.data, '_blank');
        } else {
            alert("Failed to generate PDF");
        }
    } catch (err) {
        alert("Connection error during export.");
    }
}

// --- Mock API for UI Testing ---
function mockApiCall(action, payload) {
    return new Promise((resolve) => {
        setTimeout(() => {
            console.log(`Mock API Call: ${action}`, payload);
            
            if (action === 'login') {
                if (payload.id === 'admin' && payload.password === 'admin') {
                    resolve({ status: 'success', data: { role: 'admin' } });
                } else if (payload.id.startsWith('staff')) {
                    resolve({ status: 'success', data: { role: 'staff' } });
                } else {
                    resolve({ status: 'error', message: 'Try admin/admin or staff1/any' });
                }
            }
            else if (action === 'getStaffList') {
                resolve({
                    status: 'success',
                    data: [
                        { id: 'staff1', name: 'John Doe' },
                        { id: 'staff2', name: 'Jane Smith' },
                        { id: 'staff3', name: 'Robert Johnson' }
                    ]
                });
            }
            else if (action === 'getLessons') {
                resolve({
                    status: 'success',
                    data: [
                        { row: '1', date: '2023-10-01', class: 'Grade 1A', lesson: 'Introduction to Alphabets and basic phonics.' },
                        { row: '2', date: '2023-10-02', class: 'Grade 2B', lesson: 'Basic addition and subtraction up to 20.' },
                        { row: '3', date: '2023-10-03', class: 'Grade 1A', lesson: 'Reading practice: The Cat in the Hat.' },
                        { row: '4', date: '2023-10-04', class: 'Kindergarten', lesson: 'Colors and shapes recognition activities.' }
                    ]
                });
            }
            else if (action === 'createStaff') {
                resolve({ status: 'success' });
            }
            else if (action === 'addLesson' || action === 'updateLesson' || action === 'deleteLesson') {
                resolve({ status: 'success' });
            }
            else if (action === 'changePassword') {
                resolve({ status: 'success' });
            }
            else if (action === 'exportPDF' || action === 'exportAllPDF') {
                resolve({ status: 'success', url: 'https://example.com/mock-pdf' });
            }
            else {
                resolve({ status: 'error', message: 'Unknown action' });
            }
        }, 800); // simulate network delay
    });
}
