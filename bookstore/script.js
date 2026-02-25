document.addEventListener('DOMContentLoaded', () => {
    const { initializeApp, getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged,
            getFirestore, collection, doc, setDoc, getDoc, updateDoc, deleteDoc, onSnapshot } = window.firebaseModules;

    const firebaseConfig = {
        apiKey: "AIzaSyB3hbhp4webPvlYEZtmZ3xCfLLiwOpIw0I",
        authDomain: "bookstore-8cf61.firebaseapp.com",
        projectId: "bookstore-8cf61",
        storageBucket: "bookstore-8cf61.firebasestorage.app",
        messagingSenderId: "G-JDMJTB93C3",
        appId: "1:516739220027:web:6e690e90e78056cb1a521e"
    };

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);

    let userId = null;
    let books = [];
    let isSignUp = false;

    // Elements
    const authModal = document.getElementById('auth-modal');
    const authForm = document.getElementById('auth-form');
    const authTitle = document.getElementById('auth-title');
    const authSwitch = document.getElementById('auth-switch');
    const main = document.querySelector('main');
    const logoutBtn = document.getElementById('logout-btn');
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const searchInput = document.getElementById('search');
    const booksGrid = document.getElementById('books-grid');
    const addForm = document.getElementById('add-book-form');
    const bookModal = document.getElementById('book-modal');
    const modalCover = document.getElementById('modal-cover');
    const modalTitle = document.getElementById('modal-title');
    const modalStock = document.getElementById('modal-stock');
    const toast = document.getElementById('toast');
    const totalTitlesEl = document.getElementById('total-titles');
    const totalStockEl = document.getElementById('total-stock');
    const inStockTitlesEl = document.getElementById('in-stock-titles');
    const outOfStockTitlesEl = document.getElementById('out-of-stock-titles');

    // Show Toast
    function showToast(message) {
        toast.textContent = message;
        toast.style.display = 'block';
        setTimeout(() => toast.style.display = 'none', 3000);
    }

    // Fetch Book Cover
    async function fetchBookCover(title) {
        try {
            const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(title)}`);
            const data = await response.json();
            if (data.items && data.items[0].volumeInfo.imageLinks) {
                return data.items[0].volumeInfo.imageLinks.thumbnail.replace('http:', 'https:');
            }
            return 'https://via.placeholder.com/128x192?text=No+Cover';
        } catch (error) {
            console.error('Cover fetch error:', error);
            return 'https://via.placeholder.com/128x192?text=No+Cover';
        }
    }

    // Render Books – with 3D cover wrapper
    function renderBooks(filteredBooks = books) {
        booksGrid.innerHTML = '';
        filteredBooks.sort((a, b) => a.title.localeCompare(b.title));
        filteredBooks.forEach(book => {
            const card = document.createElement('div');
            card.classList.add('book-card');
            const stockClass = book.stock > 0 ? 'stock-positive' : 'stock-zero';
            card.innerHTML = `
                <div class="book-cover-container">
                    <img src="${book.cover || 'https://via.placeholder.com/128x192?text=Book'}" alt="${book.title}">
                </div>
                <h3>${book.title}</h3>
                <p class="stock-cell ${stockClass}">${book.stock} copies</p>
                <div class="book-actions">
                    <button onclick="adjustStock('${book.id}', -1)"><i class="fas fa-minus"></i></button>
                    <button onclick="adjustStock('${book.id}', 1)"><i class="fas fa-plus"></i></button>
                    <button onclick="deleteBook('${book.id}')"><i class="fas fa-trash"></i></button>
                </div>
            `;
            card.addEventListener('click', (e) => {
                if (!e.target.closest('button')) showBookModal(book);
            });
            booksGrid.appendChild(card);
        });
        updateSummary();
    }

    // Update Summary
    function updateSummary() {
        const totalTitles = books.length;
        const totalStock = books.reduce((sum, b) => sum + b.stock, 0);
        const inStock = books.filter(b => b.stock > 0).length;
        const outOfStock = totalTitles - inStock;
        totalTitlesEl.textContent = totalTitles;
        totalStockEl.textContent = totalStock;
        inStockTitlesEl.textContent = inStock;
        outOfStockTitlesEl.textContent = outOfStock;
    }

    // Show Book Modal
    // Show Book Modal
function showBookModal(book) {
    modalCover.src = book.cover || 'https://via.placeholder.com/300x400?text=No+Cover';
    modalTitle.textContent = book.title;
    modalStock.textContent = book.stock;
    bookModal.style.display = 'flex';  // Use flex for centering
}

// Close modals (both auth and book)
document.querySelectorAll('.close').forEach(el => {
    el.addEventListener('click', () => {
        authModal.style.display = 'none';
        bookModal.style.display = 'none';
    });
});

// Also close modal when clicking outside content
bookModal.addEventListener('click', (e) => {
    if (e.target === bookModal) {  // Clicked backdrop, not content
        bookModal.style.display = 'none';
    }
});

    // Adjust Stock
    window.adjustStock = async (id, delta) => {
        const book = books.find(b => b.id === id);
        if (!book) return;
        const newStock = Math.max(0, book.stock + delta);
        await updateDoc(doc(db, `users/${userId}/books`, id), { stock: newStock });
        showToast(delta > 0 ? 'Book returned!' : 'Book borrowed!');
    };

    // Delete Book
    window.deleteBook = async (id) => {
        if (confirm('Delete this book permanently?')) {
            await deleteDoc(doc(db, `users/${userId}/books`, id));
            showToast('Book deleted!');
        }
    };

    // Add/Update Book
    addForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('title').value.trim();
        const stock = parseInt(document.getElementById('stock').value, 10);
        if (!title || isNaN(stock) || stock < 0) return showToast('Invalid input!');

        const cover = await fetchBookCover(title);
        const lowerTitle = title.toLowerCase();
        const existing = books.find(b => b.title.toLowerCase() === lowerTitle);

        try {
            if (existing) {
                await updateDoc(doc(db, `users/${userId}/books`, existing.id), { stock, cover });
                showToast(`Updated "${title}"`);
            } else {
                const newDoc = doc(collection(db, `users/${userId}/books`));
                await setDoc(newDoc, { title, stock, cover });
                showToast(`Added "${title}"`);
            }
            addForm.reset();
        } catch (error) {
            console.error(error);
            showToast('Error saving book');
        }
    });

    // Search
    searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase();
        const filtered = books.filter(b => b.title.toLowerCase().includes(query));
        renderBooks(filtered);
    });

    // Auth Form
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        try {
            if (isSignUp) {
                await createUserWithEmailAndPassword(auth, email, password);
                showToast('Account created!');
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
            authModal.style.display = 'none';
        } catch (error) {
            showToast(error.message);
        }
    });

    // Switch Sign Up / In
    authSwitch.addEventListener('click', (e) => {
        e.preventDefault();
        isSignUp = !isSignUp;
        authTitle.textContent = isSignUp ? 'Sign Up' : 'Sign In';
        authSwitch.innerHTML = isSignUp 
            ? 'Already have an account? <a href="#">Sign In</a>'
            : 'Don\'t have an account? <a href="#">Sign Up</a>';
    });

    // Logout
    logoutBtn.addEventListener('click', async () => {
        await signOut(auth);
        showToast('Logged out!');
    });

    // Dark Mode
    darkModeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark');
        darkModeToggle.innerHTML = document.body.classList.contains('dark') 
            ? '<i class="fas fa-sun"></i>' 
            : '<i class="fas fa-moon"></i>';
    });

    // Close Modals
    document.querySelectorAll('.close').forEach(el => {
        el.addEventListener('click', () => {
            authModal.style.display = 'none';
            bookModal.style.display = 'none';
        });
    });

    // Auth State
    onAuthStateChanged(auth, user => {
        if (user) {
            userId = user.uid;
            main.style.display = 'block';
            logoutBtn.style.display = 'inline-block';
            onSnapshot(collection(db, `users/${userId}/books`), snapshot => {
                books = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                renderBooks();
            });
        } else {
            main.style.display = 'none';
            logoutBtn.style.display = 'none';
            authModal.style.display = 'flex';
        }
    });
});