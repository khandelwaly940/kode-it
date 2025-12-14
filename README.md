# Kode It 🚀

**Kode It** is an advanced web-based IDE designed to bridge the gap between abstract code and visual logic. Unlike standard online compilers, Kode It focuses on **"Deep Visualization"**, allowing developers and students to see exactly how their code executes step-by-step, how variables change in the Stack/Heap, and how complex data structures (like Graphs and Matrices) evolve in real-time.

## ✨ Key Features

* **🔍 Deep Visualization Engine:**
    * **AST-Based Instrumentation:** Uses `@babel/standalone` to parse and inject breakpoints into JavaScript code intelligently.
    * **Polyglot Simulation:** Transpiles C++ and Java code into JavaScript to enable browser-based visualization of complex logic.
    * **Stack & Heap View:** Visualizes local variables (Stack Frames) and reference objects (Heap) separately.

* **📊 Advanced Data Structure Rendering:**
    * **Arrays & Matrices:** Renders 1D arrays and 2D DP tables as interactive grids.
    * **Graph Visualization:** Automatically detects adjacency lists/matrices and renders them as force-directed graphs using **D3.js**.

* **💻 Smart Code Editor:**
    * Auto-indentation and bracket closing.
    * Context-aware autocomplete suggestions.
    * Resizable workspace panes.

* **☁️ Cloud Sync:**
    * **Firebase Integration:** Save your code snippets securely to the cloud.
    * **Authentication:** Support for Google Sign-In and Anonymous Guest sessions.
    * **My Library:** Manage and revisit your saved algorithms.

* **⚡ Piston API Integration:**
    * Executes raw code safely in isolated containers for accurate output validation (supports JS, C++, Java, Python).

## 🛠️ Tech Stack

* **Frontend:** [React](https://react.dev/) (Vite), [Tailwind CSS](https://tailwindcss.com/)
* **Visualization:** [D3.js](https://d3js.org/), [@babel/standalone](https://babeljs.io/)
* **Backend (BaaS):** [Firebase](https://firebase.google.com/) (Auth, Firestore)
* **Execution Engine:** [Piston API](https://github.com/engineer-man/piston)
* **Icons:** [Lucide React](https://lucide.dev/)

## 🚀 Getting Started

Follow these steps to run Kode It locally.

### Prerequisites

* Node.js (v16+)
* npm or yarn

### Installation

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/your-username/kode-it.git](https://github.com/your-username/kode-it.git)
    cd kode-it
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Environment Variables:**
    Create a `.env` file in the root directory and add your Firebase configuration:
    ```env
    VITE_API_KEY=your_api_key
    VITE_AUTH_DOMAIN=your_project.firebaseapp.com
    VITE_PROJECT_ID=your_project_id
    VITE_STORAGE_BUCKET=your_project.appspot.com
    VITE_MESSAGING_SENDER_ID=your_sender_id
    VITE_APP_ID=your_app_id
    ```

4.  **Start the development server:**
    ```bash
    npm run dev
    ```

5.  Open `http://localhost:5173` in your browser.

## 📖 Usage Guide

1.  **Select a Language:** Choose between JavaScript, C++, Java, or Python from the toolbar.
2.  **Write Code:** Use the editor to write your algorithm.
    * *Tip:* Define a variable named `graph` (adjacency list) or `grid` (2D array) to trigger specialized D3 visualizations.
3.  **Visualize:** Click the **Visualize (BETA)** button to step through your code line-by-line.
    * Use the arrow controls to move forward/backward in time.
    * Observe the "Frames" and "Objects" panels updating in real-time.
4.  **Run:** Click **Run Code** to execute the code against the Piston API for standard output checking.
5.  **Save:** Log in to save your snippets to your personal library.

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1.  Fork the project.
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

## 🙏 Acknowledgements

* **Piston API** for providing the robust code execution engine.
* **Firebase** for seamless backend services.
* **D3.js** for powerful data visualizations.