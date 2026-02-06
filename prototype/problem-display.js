document.addEventListener('DOMContentLoaded', () => {
  const problemDisplay = document.getElementById('problem-content');

  // Function to load a LaTeX file
  function loadProblem(filePath) {
    fetch(filePath)
        .then(response => {
          if (!response.ok) {
            throw new Error(`Failed to fetch file: ${response.statusText}`);
          }
          return response.text();
        })
        .then(latexContent => {
          // Insert LaTeX content and trigger MathJax to typeset
          problemDisplay.innerHTML = `\\[${latexContent}\\]`;
          MathJax.typeset();
        })
        .catch(error => {
          problemDisplay.textContent = `Error loading problem: ${error.message}`;
        });
  }

  // Example usage
  loadProblem('./problem-display.tex'); // Update with actual .tex file path
});
