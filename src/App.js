import React, { useState, useEffect, useRef, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, addDoc, updateDoc, deleteDoc, onSnapshot, collection, query, orderBy, getDocs } from 'firebase/firestore';
import { useMemo } from 'react';

// Helper function to format content: bolding and numbered/bulleted lists, and line breaks
const formatContentForHtml = (content) => {
  // Convert bold markdown to strong HTML
  let htmlContent = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Split content into paragraphs/blocks based on double newlines
  const paragraphs = htmlContent.split('\n\n');
  let finalHtml = [];

  paragraphs.forEach(para => {
    // Check if it's a list (ordered or unordered)
    if (para.match(/^\d+\.\s/) || para.match(/^\*\s/)) {
      const lines = para.split('\n');
      let listHtml = '';
      let listType = '';

      if (lines[0].match(/^\d+\.\s/)) {
        listType = 'ol';
        listHtml += '<ol class="list-decimal list-inside pl-4">';
      } else if (lines[0].match(/^\*\s/)) {
        listType = 'ul';
        listHtml += '<ul class="list-disc list-inside pl-4">';
      }

      lines.forEach(line => {
        const trimmedLine = line.trim();
        if (listType === 'ol' && trimmedLine.match(/^\d+\.\s/)) {
          listHtml += `<li>${trimmedLine.substring(trimmedLine.indexOf('.') + 1).trim()}</li>`;
        } else if (listType === 'ul' && trimmedLine.match(/^\*\s/)) {
          listHtml += `<li>${trimmedLine.substring(2).trim()}</li>`;
        } else {
            // This case handles lines that might be part of a list but don't start with a list marker,
            // or malformed lists. For simplicity, we'll just add them as is for now.
            // A more robust parser would be needed for complex Markdown.
            htmlContent += `<br />${line}`; // Add as a line break within the current block
        }
      });
      if (listType) {
          listHtml += `</${listType}>`;
      }
      finalHtml.push(listHtml);

    } else {
      // For non-list paragraphs, replace single newlines with <br />
      finalHtml.push(para.replace(/\n/g, '<br />'));
    }
  });

  // Join blocks with a paragraph break. This adds a <p> between logical blocks.
  // We use a div with mb-4 to simulate paragraph spacing without adding empty <p> tags.
  return finalHtml.map(block => `<div class="mb-4">${block}</div>`).join('');
};


// Main App Component
const App = () => {
  // Firebase state
  const [db, setDb] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [loadingSlides, setLoadingSlides] = useState(true);
  const [ setFirebaseError] = useState(null); // Specific error for Firebase initialization - now used in UI

  // App specific state
  const [currentGemIndex, setCurrentGemIndex] = useState(0);
  const [showProblems, setShowProblems] = useState(false);
  const [currentProblemIndex, setCurrentProblemIndex] = useState(0); // New state for current problem
  const [mathJaxReady, setMathJaxReady] = useState(false);
  const [showSelectionMessage, setShowSelectionMessage] = useState(false);
  const [selectionMessageText, setSelectionMessageText] = useState('');
  const [factorizationGems, setFactorizationGems] = useState([]); // Now loaded from Firestore
  const [isSimpleAltMode, setIsSimpleAltMode] = useState(false); // New state for toggling view

  // New states for feedback and knowledge graph
  const [showInteractionModal, setShowInteractionModal] = useState(false); // Renamed from showQuestionModal
  const [interactionText, setInteractionText] = useState(''); // Renamed from questionText
  const [showKnowledgeGraphModal, setShowKnowledgeGraphModal] = useState(false);
  const [knowledgeGraphData, setKnowledgeGraphData] = useState([]); // Stores fetched clarification terms
  const [showMyInteractionsModal, setShowMyInteractionsModal] = useState(false); // Renamed from showMyQuestionsModal
  const [myInteractionsData, setMyInteractionsData] = useState([]); // Renamed from myQuestionsData
  const [showCmsLinkModal, setShowCmsLinkModal] = useState(false); // New state for CMS link modal

  // Default slide data (used if Firestore is empty or for reset)
//useMemo(() => { ... }, []);:
const defaultFactorizationGems = useMemo(() => {
    // This function will run only once on initial render
    // because the dependency array for useMemo is empty.
    return [
    {
      order: 1,
      title: "What is Factorization?",
      content: "**Factorization** is the process of breaking down an expression into a product of simpler expressions (its **factors**). It's essentially the **reverse of multiplication**.\n\nConsider the number 6:\n* Multiplication: $2 \\times 3 = 6$\n* Factorization: $6 = 2 \\times 3$\n\nFor algebraic expressions:\n* Expansion: $(x+1)(x+2) = x^2 + 3x + 2$\n* Factorization: $x^2 + 3x + 2 = (x+1)(x+2)$",
      simpleAltContent: "Let's start with an example: Take the number 6. We know $2 \\times 3 = 6$. So, 2 and 3 are the 'factors' of 6. Factorization is just finding those pieces.\n\nIn algebra, it's the same idea! If you have $x^2 + 3x + 2$, can you find two simpler expressions that multiply to give you that? Yes, $(x+1)$ and $(x+2)$! It's like 'undoing' the multiplication."
    },
    {
      order: 2,
      title: "Why Factorize Trinomials?",
      content: "Factoring trinomials ($ax^2 + bx + c$) is a **fundamental skill** in algebra. It is crucial for:\n1.  **Solving Equations:** Often used to solve quadratic and higher-order polynomial equations.\n2.  **Simplifying Expressions:** Helps simplify fractions and other algebraic expressions.\n3.  **Understanding Relationships:** Reveals the roots or zeros of a polynomial.",
      simpleAltContent: "Why bother with this? It's super useful!\n\n1.  **Solving Puzzles:** It helps us solve equations, especially those with $x^2$.\n2.  **Making Things Simpler:** It lets us break down complicated expressions into smaller, easier parts.\n3.  **Finding Key Points:** It helps us understand where a graph might hit the x-axis."
    },
    {
      order: 3,
      title: "General Strategy: Start with GCF!",
      content: "The **first and most important step** in any factorization is to look for a **Greatest Common Factor (GCF)**.\n\nAlways factor it out if there is one. This simplifies the remaining expression significantly.\n\nExample: Factor $3x^2 + 9x + 6$\n\n* Identify the common numerical factor of 3, 9, and 6, which is 3.\n* No common variables across all terms.\n* GCF = 3\n\nTherefore, $3x^2 + 9x + 6 = 3(x^2 + 3x + 2)$",
      simpleAltContent: "Always, always, always start here! Look for the **Greatest Common Factor (GCF)**.\n\nThink of $3x^2 + 9x + 6$. What's the biggest number that divides into 3, 9, and 6? It's 3!\n\nTake that 3 out, and see what's left: $3(x^2 + 3x + 2)$.\n\nThis makes the rest of the factoring much, much easier. It's your first and best move!"
    },
    {
      order: 4,
      title: "Factoring Trinomials: The $x^2 + bx + c$ Case (when $a=1$)",
      content: "This method applies to trinomials in the form $x^2 + bx + c$. You need to find **two numbers** that meet specific criteria:\n1.  **Multiply to 'c'** (the constant term)\n2.  **Add up to 'b'** (the coefficient of the middle term).\n\nLet these numbers be $p$ and $q$. The factors will be $(x+p)(x+q)$.\n\nExample: Factor $x^2 + 7x + 10$\nWe need two numbers that multiply to 10 and add to 7.\n* Pairs that multiply to 10: (1, 10), (2, 5)\n* Which pair adds to 7? (2, 5)\nSo, the numbers are 2 and 5.\nTherefore, $x^2 + 7x + 10 = (x+2)(x+5)$.",
      simpleAltContent: "Let's factor $x^2 + 7x + 10$.\n\nOur goal is to find two expressions that multiply to get this trinomial. They will look like $(x+p)(x+q)$.\n\nHow do we find 'p' and 'q'?\n\n1.  **Focus on 'c'**: The last number, 10. What numbers multiply to 10?\n    * (1, 10), (2, 5), (-1, -10), (-2, -5)\n\n2.  **Focus on 'b'**: The middle number, 7. Which of those pairs also *adds up* to 7?\n    * $1+10=11$ (Nope)\n    * $2+5=7$ (Yes!)\n\nSo, our numbers are 2 and 5.\n\nThat means $x^2 + 7x + 10 = (x+2)(x+5)$."
    },
    {
      order: 5,
      title: "Factoring Trinomials: The $ax^2 + bx + c$ Case (when $a \\neq 1$) - AC Method",
      content: "This applies to trinomials in the form $ax^2 + bx + c$ where $a$ is not 1. The **AC Method** (or Grouping Method) is a reliable approach:\n1.  **Multiply $a \\times c$** (the coefficient of $x^2$ by the constant term).\n2.  Find two numbers that **multiply to this product ($ac$)** and **add up to 'b'** (the coefficient of the middle term). Let these numbers be $p$ and $q$.\n3.  **Rewrite the middle term $bx$** as the sum of $px$ and $qx$. This transforms the trinomial into a four-term polynomial.\n4.  **Factor by grouping**.\n\nExample: Factor $2x^2 + 11x + 5$\n* $a \\times c = 2 \\times 5 = 10$.\n* Numbers that multiply to 10 and add to 11 are 1 and 10.\n* Rewrite $11x$ as $1x + 10x$: $2x^2 + 1x + 10x + 5$\n* Now, factor by grouping:\n  $(2x^2 + 1x) + (10x + 5)$\n  $x(2x + 1) + 5(2x + 1)$\n* Factor out the common binomial $(2x+1)$:\n  $(2x + 1)(x + 5)$",
      simpleAltContent: "Let's factor $2x^2 + 11x + 5$.\n\n1.  **Multiply 'a' and 'c'**: $2 \\times 5 = 10$.\n\n2.  **Find two numbers**: What two numbers multiply to 10 and add up to 'b' (which is 11)? The numbers are 1 and 10.\n\n3.  **Split the middle term**: Rewrite $11x$ using those numbers: $2x^2 + 1x + 10x + 5。\n\n4.  **Group and factor**: Now group the first two and last two terms:\n    * $(2x^2 + 1x)$ and $(10x + 5)$\n    * Factor out common terms: $x(2x+1)$ and $5(2x+1)$\n    * Notice $(2x+1)$ is common! So, $(2x+1)(x+5)$. That's it!"
    },
    {
      order: 6,
      title: "Special Factoring Patterns: Perfect Square Trinomials",
      content: "Recognizing these patterns can significantly speed up factorization. A perfect square trinomial results from squaring a binomial.\n\nThe patterns are:\n* $a^2 + 2ab + b^2 = (a + b)^2$\n* $a^2 - 2ab + b^2 = (a - b)^2$\n\nExample: Factor $x^2 + 6x + 9$\n* Recognize $x^2$ as $a^2$ (so $a=x$)\n* $9$ as $b^2$ (so $b=3$)\n* The middle term $6x$ is $2(x)(3)$, which matches $2ab$.\nTherefore, $x^2 + 6x + 9 = (x+3)^2$.\n\nExample: Factor $4y^2 - 12y + 9$\n* Recognize $4y^2$ as $(2y)^2$ (so $a=2y$)\n* $9$ as $3^2$ (so $b=3$)\n* The middle term $-12y$ is $2(2y)(-3)$, which matches $-2ab$.\nTherefore, $4y^2 - 12y + 9 = (2y-3)^2$.",
      simpleAltContent: "Look at $x^2 + 6x + 9$. Does it look familiar?\n\n* Is the first term ($x^2$) a perfect square? Yes, $x^2 = (x)^2$.\n* Is the last term (9) a perfect square? Yes, $9 = (3)^2$.\n* Is the middle term ($6x$) twice the product of 'x' and '3'? Yes, $2 \\times x \\times 3 = 6x$.\n\nIf all these are 'yes', then it's a **Perfect Square Trinomial**! You can write it simply as $(x+3)^2$. It's a quick shortcut when you spot the pattern!"
    }
  ]}, []);


  // Data for practice problems (removed duplicate entries)
  const problems = [
    {
      id: 1,
      question: "$x^2 + 8x + 15$",
      correctAnswer: "(x+3)(x+5)",
      hint: "This is a trinomial where $a=1$. Find two numbers that multiply to 15 and add to 8.",
      type: "a=1",
      solutionSteps: [
        "**Step 1: Identify 'b' and 'c'.** For $x^2 + 8x + 15$, $b=8$ and $c=15$.",
        "**Step 2: Find two numbers that multiply to 'c' and add to 'b'.** We need two numbers that multiply to 15 and add to 8. Let's list factors of 15: (1, 15), (3, 5).",
        "**Step 3: Test the sums.**\n* $1 + 15 = 16$ (No)\n* $3 + 5 = 8$ (Yes!)\nSo, the numbers are 3 and 5.",
        "**Step 4: Write the factored form.** The factored form is $(x+p)(x+q)$. So, $x^2 + 8x + 15 = (x+3)(x+5)$."
      ]
    },
    {
      id: 2,
      question: "$x^2 - 6x + 8$",
      correctAnswer: "(x-2)(x-4)",
      hint: "This is a trinomial where $a=1$. Find two numbers that multiply to 8 and add to -6.",
      type: "a=1",
      solutionSteps: [
        "**Step 1: Identify 'b' and 'c'.** For $x^2 - 6x + 8$, $b=-6$ and $c=8$.",
        "**Step 2: Find two numbers that multiply to 'c' and add to 'b'.** We need two numbers that multiply to 8 and add to -6. Since the product is positive and the sum is negative, both numbers must be negative.\nFactors of 8: (-1, -8), (-2, -4).",
        "**Step 3: Test the sums.**\n* $-1 + (-8) = -9$ (No)\n* $-2 + (-4) = -6$ (Yes!)\nSo, the numbers are -2 and -4.",
        "**Step 4: Write the factored form.** The factored form is $(x+p)(x+q)$. So, $x^2 - 6x + 8 = (x-2)(x-4)$."
      ]
    },
    {
      id: 3,
      question: "$2x^2 + 7x + 3$",
      correctAnswer: "(2x+1)(x+3)",
      hint: "This is a trinomial where $a \\neq 1$. Use the AC method: multiply $a \\times c$ (2*3=6), then find two numbers that multiply to 6 and add to 7. Rewrite the middle term and factor by grouping.",
      type: "a!=1",
      solutionSteps: [
        "**Step 1: Identify 'a', 'b', and 'c'.** For $2x^2 + 7x + 3$, $a=2$, $b=7$, $c=3$.",
        "**Step 2: Calculate $a \\times c$.** $a \\times c = 2 \\times 3 = 6$.",
        "**Step 3: Find two numbers that multiply to $ac$ (6) and add to 'b' (7).** The numbers are 1 and 6 ($1 \\times 6 = 6$, $1 + 6 = 7$).",
        "**Step 4: Rewrite the middle term.** Rewrite $7x$ as $1x + 6x$: $2x^2 + 1x + 6x + 3$.",
        "**Step 5: Factor by grouping.**\n* Group the first two terms: $(2x^2 + 1x) = x(2x + 1)$\n* Group the last two terms: $(6x + 3) = 3(2x + 1)$",
        "**Step 6: Factor out the common binomial.** Notice that $(2x+1)$ is common to both factored groups. So, $x(2x+1) + 3(2x+1) = (2x+1)(x+3)$."
      ]
    },
    {
      id: 4,
      question: "$3x^2 - 10x + 8$",
      correctAnswer: "(3x-4)(x-2)",
      hint: "This is a trinomial where $a \\neq 1$. Use the AC method: multiply $a \\times c$ (3*8=24), then find two numbers that multiply to 24 and add to -10. Rewrite the middle term and factor by grouping.",
      type: "a!=1",
      solutionSteps: [
        "**Step 1: Identify 'a', 'b', and 'c'.** For $3x^2 - 10x + 8$, $a=3$, $b=-10$, $c=8$.",
        "**Step 2: Calculate $a \\times c$.** $a \\times c = 3 \\times 8 = 24$.",
        "**Step 3: Find two numbers that multiply to $ac$ (24) and add to 'b' (-10).** Since the product is positive and the sum is negative, both numbers must be negative. The numbers are -4 and -6 ($-4 \\times -6 = 24$, $-4 + -6 = -10$).",
        "**Step 4: Rewrite the middle term.** Rewrite $-10x$ as $-4x - 6x$: $3x^2 - 4x - 6x + 8$.",
        "**Step 5: Factor by grouping.**\n* Group the first two terms: $(3x^2 - 4x) = x(3x - 4)$\n* Group the last two terms: $(-6x + 8) = -2(3x - 4)$ (Factor out -2 to get the same binomial)",
        "**Step 6: Factor out the common binomial.** Notice that $(3x-4)$ is common to both factored groups. So, $x(3x-4) - 2(3x-4) = (3x-4)(x-2)$."
      ]
    },
    {
      id: 5,
      question: "$x^2 + 10x + 25$",
      correctAnswer: "(x+5)^2",
      hint: "This looks like a Perfect Square Trinomial. Check if the first term is a square ($x^2$), the last term is a square ($5^2$), and the middle term is $2 \\times x \\times 5$.",
      type: "perfectSquare",
      solutionSteps: [
        "**Step 1: Check if the first and last terms are perfect squares.**\n* $x^2 = (x)^2$\n* $25 = (5)^2$",
        "**Step 2: Check if the middle term fits the pattern $2ab$.**\n* $2 \\times (x) \\times (5) = 10x$.\nThis matches the middle term of $x^2 + 10x + 25$.",
        "**Step 3: Write as a perfect square.** Since it fits the pattern $a^2 + 2ab + b^2 = (a+b)^2$, the factored form is $(x+5)^2$."
      ]
    },
    {
      id: 6,
      question: "$9y^2 - 12y + 4$",
      correctAnswer: "(3y-2)^2",
      hint: "This looks like a Perfect Square Trinomial. Check if the first term is a square ($(3y)^2$), the last term is a square ($2^2$), and the middle term is $2 \\times (3y) \\times (-2)$.",
      type: "perfectSquare",
      solutionSteps: [
        "**Step 1: Check if the first and last terms are perfect squares.**\n* $9y^2 = (3y)^2。\n* $4 = (2)^2$",
        "**Step 2: Check if the middle term fits the pattern $-2ab$.**\n* $-2 \\times (3y) \\times (2) = -12y$.\nThis matches the middle term of $9y^2 - 12y + 4$.",
        "**Step 3: Write as a perfect square.** Since it fits the pattern $a^2 - 2ab + b^2 = (a-b)^2$, the factored form is $(3y-2)^2$."
      ]
    },
    {
      id: 7,
      question: "$5x^2 + 15x + 10$",
      correctAnswer: "5(x+1)(x+2)",
      hint: "Always look for a Greatest Common Factor (GCF) first! Factor out the GCF, then factor the remaining trinomial.",
      type: "gcf",
      solutionSteps: [
        "**Step 1: Find the GCF.** The greatest common factor of $5x^2$, $15x$, and $10$ is 5.",
        "**Step 2: Factor out the GCF.**\n$5x^2 + 15x + 10 = 5(x^2 + 3x + 2)$.",
        "**Step 3: Factor the remaining trinomial ($x^2 + 3x + 2$).** This is an $a=1$ case. We need two numbers that multiply to 2 and add to 3. The numbers are 1 and 2.",
        "**Step 4: Write the final factored form.** Combine the GCF with the factored trinomial:\n$5(x+1)(x+2)$."
      ]
    }
  ];

  // State for managing user answers and feedback for problems
  const [problemStates, setProblemStates] = useState(
    problems.map(problem => ({
      ...problem,
      userAnswer: '',
      isCorrect: null, // null: not checked, true: correct, false: incorrect
      showHint: false, // For hover effect
      visibleSolutionStepsCount: 0 // New state for solution steps
    }))
  );



  // Use useMemo to create a stable firebaseConfig object
  const firebaseConfig = useMemo(() => {
    // The conditional logic goes inside the useMemo callback

     // Firebase Configuration: Use the global __firebase_config provided by the Canvas environment
  const fc = typeof window !== 'undefined' && window.__firebase_config
    ? JSON.parse(window.__firebase_config)
    : {
        // Fallback to your hardcoded config if __firebase_config is not available (e.g., for local dev outside Canvas)
        apiKey: "AIzaSyDaJBnbm_efzRqkBX6yNV4K8yDoWSIdgng",
        authDomain: "trinomdatabase.firebaseapp.com",
        projectId: "trinomdatabase",
        storageBucket: "trinomdatabase.firebasestorage.app",
        messagingSenderId: "951239176854",
        appId: "1:951239176854:web:c36396564c1e2da02bc8b7",
        measurementId: "G-9WK6X3P0QL"
      };
      return fc;
    }
  }, []);
  
 

  // 1. Firebase Initialization and Auth
  useEffect(() => {
    // Ensure window object exists before accessing global Canvas variables
    if (typeof window === 'undefined') {
      console.warn("Window object not available, skipping Firebase initialization.");
      setLoadingSlides(false);
      setFirebaseError("Environment error: Window object not found. Cannot initialize Firebase.");
      setFactorizationGems(defaultFactorizationGems); // Fallback
      return;
    }

    // Check if firebaseConfig is valid
    if (!firebaseConfig || !firebaseConfig.apiKey) {
      console.error("Firebase config is missing API key or is invalid. Cannot initialize Firebase.");
      setLoadingSlides(false);
      setFirebaseError("Firebase configuration error. Please ensure your project is correctly configured.");
      setFactorizationGems(defaultFactorizationGems); // Fallback
      return;
    }

    try {
      const app = initializeApp(firebaseConfig);
      const firestore = getFirestore(app);
      const firebaseAuth = getAuth(app);

      setDb(firestore);
      // setAuth(firebaseAuth); // Removed unused state setter

      const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
        if (user) {
          setUserId(user.uid);
          console.log("Authenticated with user ID:", user.uid);
        } else {
          // Sign in anonymously if no user is authenticated
          try {
            const initialAuthToken = typeof window.__initial_auth_token !== 'undefined'
              ? window.__initial_auth_token
              : null;

            if (initialAuthToken) {
              await signInWithCustomToken(firebaseAuth, initialAuthToken);
              console.log("Signed in with custom token.");
            } else {
              await signInAnonymously(firebaseAuth);
              console.log("Signed in anonymously.");
            }
            setUserId(firebaseAuth.currentUser?.uid || crypto.randomUUID()); // Ensure userId is set
          } catch (error) {
            console.error("Firebase authentication error:", error);
            // Specifically handle custom-token-mismatch
            if (error.code === 'auth/custom-token-mismatch') {
                setFirebaseError(`Authentication error: Custom token mismatch. Please ensure your Firebase project ID in the hardcoded config matches the Canvas environment's project.`);
            } else {
                setFirebaseError(`Authentication error: ${error.message}`);
            }
            setUserId(crypto.randomUUID()); // Fallback to a random ID if auth fails
          }
        }
        setIsAuthReady(true);
      });

      return () => unsubscribe();
    } catch (err) {
      console.error("Failed to initialize Firebase:", err);
      setFirebaseError(`Firebase initialization failed: ${err.message}`);
      setLoadingSlides(false); // Stop loading if init fails
      setFactorizationGems(defaultFactorizationGems); // Fallback
    }
  }, [defaultFactorizationGems, setFirebaseError, firebaseConfig]); // Depend on firebaseConfig to re-initialize if it changes (though unlikely for hardcoded)

  // 2. Fetch slides from Firestore
  useEffect(() => {
    if (db && userId && isAuthReady) {
      // Access global __app_id safely
      const appId = typeof window !== 'undefined' && window.__app_id ? window.__app_id : 'default-app-id';
      const slidesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/factorizationSlides`);
      const q = query(slidesCollectionRef); // No orderBy due to potential index issues

      const unsubscribe = onSnapshot(q, async (snapshot) => {
        if (snapshot.empty) {
          console.log("No slides found in Firestore. Populating with default slides.");
          // Immediately set default gems so UI has content, then add to Firestore
          setFactorizationGems(defaultFactorizationGems);
          for (const gem of defaultFactorizationGems) {
            await addDoc(slidesCollectionRef, gem);
          }
          // The subsequent snapshot will confirm, but this provides immediate content
        } else {
          const fetchedGems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          // Sort locally by 'order' field as orderBy in query is avoided
          fetchedGems.sort((a, b) => a.order - b.order);
          setFactorizationGems(fetchedGems);
        }
        setLoadingSlides(false);
      }, (error) => {
        console.error("Error fetching slides from Firestore:", error);
        setLoadingSlides(false);
        setFirebaseError(`Error fetching slides: ${error.message}. Please check Firestore Security Rules.`);
        setFactorizationGems(defaultFactorizationGems); // Fallback to default local slides on error
      });

      return () => unsubscribe();
    } else if (!db && !isAuthReady) {
        // If Firebase not configured or auth not ready, ensure loading state is false and use default local slides
        setLoadingSlides(false);
        setFactorizationGems(defaultFactorizationGems);
    }
  }, [db, userId, isAuthReady, setFirebaseError, defaultFactorizationGems]); // Added defaultFactorizationGems to dependencies

  // 3. MathJax Loading and Readiness (Existing logic)
  useEffect(() => {
    // MathJax Configuration - must be defined before loading the script
    window.MathJax = {
      tex: {
        inlineMath: [['$', '$'], ['\\(', '\\)']] // Explicitly define inline math delimiters
      },
      svg: {
        fontCache: 'global'
      }
    };

    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js";
    script.async = true;
    script.id = "MathJax-script";

    script.onload = () => {
      if (window.MathJax) {
        window.MathJax.startup.promise.then(() => {
          setMathJaxReady(true);
        }).catch(err => console.error("MathJax startup error:", err));
      }
    };

    script.onerror = (err) => {
      console.error("Failed to load MathJax script:", err);
    };

    document.head.appendChild(script);

    return () => {
      const existingScript = document.getElementById('MathJax-script');
      if (existingScript) {
        existingScript.remove();
      }
      if (window.MathJax) {
        delete window.MathJax;
      }
    };
  }, []);

  // Function to handle next gem/slide
  const handleNextGem = () => {
    if (currentGemIndex < factorizationGems.length - 1) {
      setCurrentGemIndex(currentGemIndex + 1);
    } else {
      setShowProblems(true); // Transition to problems after last gem
      setCurrentProblemIndex(0); // Reset problem index when starting problems
    }
  };

  // Function to handle previous gem/slide
  const handlePrevGem = () => {
    if (currentGemIndex > 0) {
      setCurrentGemIndex(currentGemIndex - 1);
    }
  };

  // Function to handle next problem
  const handleNextProblem = () => {
    if (currentProblemIndex < problems.length - 1) {
      setCurrentProblemIndex(currentProblemIndex + 1);
    }
  };

  // Function to handle previous problem
  const handlePrevProblem = () => {
    if (currentProblemIndex > 0) {
      setCurrentProblemIndex(currentProblemIndex - 1);
    }
  };

  // Function to update problem state from ProblemCard (callback from child to parent)
  const handleProblemUpdate = useCallback((id, updatedFields) => {
    setProblemStates(prevStates =>
      prevStates.map(problem =>
        problem.id === id ? { ...problem, ...updatedFields } : problem
      )
    );
  }, []);

  // Callback for word selection - NOW SAVES TO FIRESTORE
  const handleWordSelection = useCallback(async (word) => {
    const trimmedWord = word.trim();
    if (trimmedWord && trimmedWord.length > 1 && db && userId) {
      const appId = typeof window !== 'undefined' && window.__app_id ? window.__app_id : 'default-app-id';
      const clarificationRequestsRef = collection(db, `artifacts/${appId}/users/${userId}/clarificationRequests`);
      try {
        await addDoc(clarificationRequestsRef, {
          term: trimmedWord.toLowerCase(),
          slideTitle: factorizationGems[currentGemIndex]?.title || 'Unknown Slide', // Save context
          timestamp: new Date()
        });
        setSelectionMessageText(`'${trimmedWord}' added for clarification!`);
        setShowSelectionMessage(true);
        setTimeout(() => setShowSelectionMessage(false), 2000);
      } catch (error) {
        console.error("Error saving clarification request to Firestore:", error);
        setSelectionMessageText(`Failed to save '${trimmedWord}' for clarification.`);
        setShowSelectionMessage(true);
        setTimeout(() => setShowSelectionMessage(false), 3000);
      }
    } else if (!db || !userId) {
      setSelectionMessageText("Firebase not ready to save clarification requests.");
      setShowSelectionMessage(true);
      setTimeout(() => setShowSelectionMessage(false), 2000);
    }
  }, [db, userId, factorizationGems, currentGemIndex]); // Dependencies for useCallback


  // Function to populate Firestore with default slides
  const populateDefaultSlides = async () => {
    if (db && userId) {
      setLoadingSlides(true);
      const appId = typeof window !== 'undefined' && window.__app_id ? window.__app_id : 'default-app-id';
      const slidesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/factorizationSlides`);
      // Clear existing slides first (optional, but good for "reset" functionality)
      const existingDocs = await getDocs(slidesCollectionRef);
      const deletePromises = existingDocs.docs.map(d => deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/factorizationSlides`, d.id)));
      await Promise.all(deletePromises);

      // Add default slides
      for (const gem of defaultFactorizationGems) {
        await addDoc(slidesCollectionRef, gem);
      }
      setLoadingSlides(false);
      setCurrentGemIndex(0); // Reset to first slide
      setSelectionMessageText("Default slides loaded!");
      setShowSelectionMessage(true);
      setTimeout(() => setShowSelectionMessage(false), 2000);
    } else {
      setSelectionMessageText("Firebase not ready to load default slides.");
      setShowSelectionMessage(true);
      setTimeout(() => setShowSelectionMessage(false), 2000);
    }
  };

  // --- Interaction (Question/Comment/Feature Request) Logic ---

  // Handle submitting user interaction
  const handleSubmitInteraction = async () => {
    if (db && userId && interactionText.trim()) {
      const appId = typeof window !== 'undefined' && window.__app_id ? window.__app_id : 'default-app-id';
      const interactionsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/userInteractions`); // Changed collection name
      try {
        await addDoc(interactionsCollectionRef, {
          type: 'question/comment/feature', // Added a type field for future filtering
          content: interactionText.trim(), // Renamed from 'question'
          contextSlide: showProblems ? `Problem ${currentProblemIndex + 1}` : factorizationGems[currentGemIndex]?.title || 'Unknown',
          timestamp: new Date()
        });
        setSelectionMessageText("Your input has been submitted! Thank you."); // Updated message
        setShowSelectionMessage(true);
        setTimeout(() => setShowSelectionMessage(false), 2000);
        setInteractionText(''); // Clear text
        setShowInteractionModal(false); // Close modal
      } catch (error) {
        console.error("Error submitting interaction:", error);
        setSelectionMessageText("Failed to submit your input.");
        setShowSelectionMessage(true);
        setTimeout(() => setShowSelectionMessage(false), 3000);
      }
    } else {
      setSelectionMessageText("Please enter your question, comment, or feature request."); // Updated message
      setShowSelectionMessage(true);
      setTimeout(() => setShowSelectionMessage(false), 2000);
    }
  };

  // Fetch knowledge graph data (clarification requests)
  const fetchKnowledgeGraphData = useCallback(async () => {
    if (db && userId) {
      const appId = typeof window !== 'undefined' && window.__app_id ? window.__app_id : 'default-app-id';
      const clarificationRequestsRef = collection(db, `artifacts/${appId}/users/${userId}/clarificationRequests`);
      try {
        const q = query(clarificationRequestsRef, orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setKnowledgeGraphData(data);
      } catch (error) {
        console.error("Error fetching knowledge graph data:", error);
        setKnowledgeGraphData([]);
      }
    }
  }, [db, userId]);

  // Fetch 'My Interactions' data
  const fetchMyInteractionsData = useCallback(async () => {
    if (db && userId) {
      const appId = typeof window !== 'undefined' && window.__app_id ? window.__app_id : 'default-app-id';
      const interactionsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/userInteractions`); // Changed collection name
      try {
        const q = query(interactionsCollectionRef, orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setMyInteractionsData(data);
      } catch (error) {
        console.error("Error fetching my interactions data:", error);
        setMyInteractionsData([]);
      }
    }
  }, [db, userId]);

  // Edit an interaction
  const handleEditInteraction = async (id, newContent) => {
    if (db && userId) {
      const appId = typeof window !== 'undefined' && window.__app_id ? window.__app_id : 'default-app-id';
      const interactionDocRef = doc(db, `artifacts/${appId}/users/${userId}/userInteractions`, id);
      try {
        await updateDoc(interactionDocRef, {
          content: newContent,
          timestamp: new Date() // Update timestamp on edit
        });
        setSelectionMessageText("Interaction updated!");
        setShowSelectionMessage(true);
        setTimeout(() => setShowSelectionMessage(false), 2000);
        fetchMyInteractionsData(); // Re-fetch to update the list
      } catch (error) {
        console.error("Error updating interaction:", error);
        setSelectionMessageText("Failed to update interaction.");
        setShowSelectionMessage(true);
        setTimeout(() => setShowSelectionMessage(false), 3000);
      }
    }
  };

  // Delete an interaction
  const handleDeleteInteraction = async (id) => {
    // Using window.confirm for simplicity, replace with custom modal if needed in a production app
    if (db && userId && window.confirm("Are you sure you want to delete this entry?")) {
      const appId = typeof window !== 'undefined' && window.__app_id ? window.__app_id : 'default-app-id';
      const interactionDocRef = doc(db, `artifacts/${appId}/users/${userId}/userInteractions`, id);
      try {
        await deleteDoc(interactionDocRef);
        setSelectionMessageText("Interaction deleted!");
        setShowSelectionMessage(true);
        setTimeout(() => setShowSelectionMessage(false), 2000);
        fetchMyInteractionsData(); // Re-fetch to update the list
      } catch (error) {
        console.error("Error deleting interaction:", error);
        setSelectionMessageText("Failed to delete interaction.");
        setShowSelectionMessage(true);
        setTimeout(() => setShowSelectionMessage(false), 3000);
      }
    }
  };


  // Effect to fetch knowledge graph data when modal opens
  useEffect(() => {
    if (showKnowledgeGraphModal) {
      fetchKnowledgeGraphData();
    }
  }, [showKnowledgeGraphModal, fetchKnowledgeGraphData]);

  // Effect to fetch 'My Interactions' data when modal opens
  useEffect(() => {
    if (showMyInteractionsModal) {
      fetchMyInteractionsData();
    }
  }, [showMyInteractionsModal, fetchMyInteractionsData]);


  // Component for displaying a single information gem/slide
  const FactorizationGem = ({ title, content, simpleAltContent, mathJaxReady, onWordSelect, isSimpleAltMode, onToggleSimpleAlt }) => {
    const contentRef = useRef(null); // Create a ref for the content paragraph
    const titleRef = useRef(null); // New ref for the title paragraph

    // MathJax for rendering LaTeX
    useEffect(() => {
      if (mathJaxReady) {
        // Process both title and content refs
        if (titleRef.current) {
          window.MathJax.typesetPromise([titleRef.current]);
        }
        if (contentRef.current) {
          window.MathJax.typesetPromise([contentRef.current]);
        }
      }
    }, [title, content, simpleAltContent, mathJaxReady, isSimpleAltMode]); // Rerender MathJax when title, content or readiness changes

    const handleMouseUp = () => {
      const selection = window.getSelection();
      if (selection && selection.toString().length > 0) {
        onWordSelect(selection.toString());
      }
    };

    const displayedContent = isSimpleAltMode ? simpleAltContent : content;

    return (
      <div className="bg-white p-8 rounded-2xl shadow-xl border border-blue-200 text-left max-w-5xl w-full mx-auto my-8 transform transition-all duration-500 hover:scale-105">
        <div className="flex justify-between items-center mb-4">
          <h2 ref={titleRef} className="text-3xl font-extrabold text-blue-800" dangerouslySetInnerHTML={{ __html: title }}></h2>
          <button
            onClick={onToggleSimpleAlt}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-full shadow-md transition duration-300 transform hover:scale-105 text-sm"
          >
            {isSimpleAltMode ? "Show Detailed View" : "Toggle Simple View"}
          </button>
        </div>
        <div ref={contentRef} className="text-gray-700 text-lg leading-relaxed" dangerouslySetInnerHTML={{ __html: formatContentForHtml(displayedContent) }} onMouseUp={handleMouseUp}></div>
      </div>
    );
  };

  // Component for a single practice problem
  const ProblemCard = ({ problem, onProblemUpdate, mathJaxReady }) => {
    // Internal states for the current problem
    const [userAnswer, setUserAnswer] = useState(problem.userAnswer);
    const [isCorrect, setIsCorrect] = useState(problem.isCorrect);
    const [visibleSolutionStepsCount, setVisibleSolutionStepsCount] = useState(problem.visibleSolutionStepsCount);

    const [isHoveringHint, setIsHoveringHint] = useState(false);
    const questionRef = useRef(null); // Ref for the question paragraph
    const solutionRef = useRef(null); // Ref for the solution steps

    // Sync internal state with prop when problem changes (e.g., navigating to next problem)
    useEffect(() => {
      setUserAnswer(problem.userAnswer);
      setIsCorrect(problem.isCorrect);
      setVisibleSolutionStepsCount(problem.visibleSolutionStepsCount);
    }, [problem.id, problem.userAnswer, problem.isCorrect, problem.visibleSolutionStepsCount]); // Added missing dependencies

    // MathJax for rendering LaTeX
    useEffect(() => {
      if (mathJaxReady) {
        if (questionRef.current) {
          window.MathJax.typesetPromise([questionRef.current]);
        }
        // Only typeset solution if it's visible, and re-typeset when visible steps count changes
        if (solutionRef.current && visibleSolutionStepsCount > 0) {
          window.MathJax.typesetPromise([solutionRef.current]);
        }
      }
    }, [problem.question, visibleSolutionStepsCount, mathJaxReady]); // Rerender MathJax when question or readiness changes


    // Handlers for solution steps
    const handleShowNextStep = () => {
      const newCount = Math.min(visibleSolutionStepsCount + 1, problem.solutionSteps.length);
      setVisibleSolutionStepsCount(newCount);
      // Notify parent about solution visibility change
      onProblemUpdate(problem.id, { visibleSolutionStepsCount: newCount });
    };

    const handleHideSolution = () => {
      setVisibleSolutionStepsCount(0);
      // Notify parent about solution visibility change
      onProblemUpdate(problem.id, { visibleSolutionStepsCount: 0 });
    };

    const handleCheckAnswer = () => {
      // Normalize answers for comparison (same logic as before)
      const normalize = (str) => {
        let normalized = str.replace(/\s/g, '').toLowerCase();
        if (normalized.startsWith('(') && normalized.endsWith(')')) {
          const parts = normalized.substring(1, normalized.length - 1).split(')(');
          if (parts.length === 2) {
            return [parts[0], parts[1]].sort().join(')(');
          }
        }
        return normalized;
      };

      const normalizedUserAnswer = normalize(userAnswer);
      const normalizedCorrectAnswer = normalize(problem.correctAnswer);

      let correct = normalizedUserAnswer === normalizedCorrectAnswer;

      // Special handling for GCF and Perfect Square types
      if (problem.type === "gcf" && problem.correctAnswer.includes(')(')) {
          const gcf = problem.correctAnswer.split('(')[0];
          const binomialsCorrect = problem.correctAnswer.substring(gcf.length).replace(/\s/g, '').toLowerCase();
          const binomialsUser = userAnswer.substring(gcf.length).replace(/\s/g, '').toLowerCase();

          const [b1Correct, b2Correct] = binomialsCorrect.substring(1, binomialsCorrect.length - 1).split(')(');
          const [b1User, b2User] = binomialsUser.substring(1, binomialsUser.length - 1).split(')(');

          correct = (gcf === userAnswer.split('(')[0].replace(/\s/g, '').toLowerCase() &&
                     ((b1Correct === b1User && b2Correct === b2User) || (b1Correct === b2User && b2Correct === b1User)));
      } else if (problem.type === "perfectSquare") {
          const correctParts = problem.correctAnswer.replace(/[()^2]/g, '').split('+').map(p => p.trim());
          const userParts = userAnswer.replace(/[()^2]/g, '').split('+').map(p => p.trim());

          if (correctParts.length === 2 && userParts.length === 2) {
              const sortedCorrect = [...correctParts].sort().join('+');
              const sortedUser = [...userParts].sort().join('+');
              correct = (sortedCorrect === sortedUser && userAnswer.includes('^2'));
          }
      }

      setIsCorrect(correct);
      // Notify parent about the check result
      onProblemUpdate(problem.id, { userAnswer, isCorrect: correct });
    };


    const hasSolution = problem.solutionSteps && problem.solutionSteps.length > 0;
    const allStepsVisible = visibleSolutionStepsCount === problem.solutionSteps.length;

    return (
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-purple-200 relative mb-6">
        <div
          className="absolute top-4 right-4 text-purple-500 cursor-help text-2xl"
          onMouseEnter={() => setIsHoveringHint(true)}
          onMouseLeave={() => setIsHoveringHint(false)}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-7 h-7 transform transition-transform duration-200 hover:scale-110"
          >
            <path
              fillRule="evenodd"
              d="M10.788 3.212a.75.75 0 0 0-1.576 0l-1.039 3.098A9.748 9.748 0 0 0 3.81 9.772c.069.664.032 1.33-.1 1.988a9.749 9.749 0 0 0 .52 3.518c.277.747.535 1.49.799 2.227.098.272.298.54.487.707.232.204.487.354.75.476.35.155.67.262 1.002.327a4.6 4.6 0 0 0 1.026.189c.28.02.56.02.84 0a4.6 4.6 0 0 0 1.026-.189c.332-.065.652-.172 1.002-.327.263-.122.518-.272.75-.476.19-.167.39-.435.487-.707.264-.736.522-1.48.799-2.227a9.749 9.749 0 0 0 .52-3.518c-.132-.657-.17-1.324-.1-1.988.337-3.266 1.945-6.102 4.426-7.794a.75.75 0 0 0-1.002-1.124A8.25 8.25 0 0 1 12 4.153 8.25 8.25 0 0 1 10.788 3.212ZM12 12.75a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z"
              clipRule="evenodd"
            />
          </svg>
          {isHoveringHint && (
            <div className="absolute right-0 mt-2 w-64 p-3 bg-purple-700 text-white text-sm rounded-lg shadow-lg z-10 opacity-95 transition-opacity duration-300">
              {problem.hint}
            </div>
          )}
        </div>
        <h3 className="text-2xl font-semibold text-gray-800 mb-4">Problem {problem.id}</h3>
        {/* Use dangerouslySetInnerHTML for the question as well */}
        <p ref={questionRef} className="text-xl font-medium text-blue-600 mb-4" dangerouslySetInnerHTML={{ __html: problem.question }}></p>
        <input
          type="text"
          value={userAnswer}
          onChange={(e) => setUserAnswer(e.target.value)}
          placeholder="Enter your factored answer (e.g., (x+1)(x+2) or 5(x+1)(x+2))"
          className="w-full p-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-lg"
        />
        <button
          onClick={handleCheckAnswer}
          className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition duration-300 transform hover:scale-105 shadow-md"
        >
          Check Answer
        </button>
        {isCorrect !== null && (
          <p className={`mt-3 text-lg font-semibold ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
            {isCorrect ? 'Correct! 🎉' : `Incorrect. The correct answer is: ${problem.correctAnswer}`}
          </p>
        )}

        {/* Solution Section */}
        {hasSolution && (
          <div className="mt-6 pt-4 border-t-2 border-gray-200">
            <h4 className="text-xl font-semibold text-gray-700 mb-3">Solution:</h4>
            <div ref={solutionRef}>
              {problem.solutionSteps.slice(0, visibleSolutionStepsCount).map((step, index) => (
                <div key={index} className="mb-2 text-gray-600 text-base" dangerouslySetInnerHTML={{ __html: formatContentForHtml(step) }}></div>
              ))}
            </div>
            <div className="flex space-x-2 mt-4">
              {visibleSolutionStepsCount === 0 ? (
                <button
                  onClick={handleShowNextStep}
                  className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-full shadow-md transition duration-300 transform hover:scale-105 text-sm"
                >
                  Show Solution
                </button>
              ) : (
                <>
                  <button
                    onClick={handleShowNextStep}
                    disabled={allStepsVisible}
                    className={`bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-full shadow-md transition duration-300 transform text-sm ${
                      allStepsVisible ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'
                    }`}
                  >
                    Show Next Step
                  </button>
                  <button
                    onClick={handleHideSolution}
                    className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-full shadow-md transition duration-300 transform hover:scale-105 text-sm"
                  >
                    Hide Solution
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Component for My Interactions Modal
  const MyInteractionsModal = ({ show, onClose, interactions, onEdit, onDelete }) => {
    const [editingId, setEditingId] = useState(null);
    const [currentEditText, setCurrentEditText] = useState('');

    useEffect(() => {
      if (!show) {
        setEditingId(null); // Reset editing state when modal closes
        setCurrentEditText('');
      }
    }, [show]);

    const handleStartEdit = (item) => {
      setEditingId(item.id);
      setCurrentEditText(item.content);
    };

    const handleSaveEdit = (id) => {
      onEdit(id, currentEditText);
      setEditingId(null);
      setCurrentEditText('');
    };

    if (!show) return null;

    return (
      <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-xl w-full">
          <h3 className="text-2xl font-bold text-gray-800 mb-4">My Submitted Questions, Comments & Feature Requests</h3>
          {interactions.length > 0 ? (
            <ul className="list-disc list-inside text-gray-700 max-h-80 overflow-y-auto pr-2">
              {interactions.map((item) => (
                <li key={item.id} className="mb-4 p-3 border border-gray-200 rounded-lg bg-gray-50">
                  {editingId === item.id ? (
                    <>
                      <textarea
                        className="w-full p-2 border-2 border-blue-300 rounded-lg focus:outline-none focus:border-blue-500 text-base"
                        rows="3"
                        value={currentEditText}
                        onChange={(e) => setCurrentEditText(e.target.value)}
                      ></textarea>
                      <div className="flex justify-end space-x-2 mt-2">
                        <button
                          onClick={() => handleSaveEdit(item.id)}
                          className="bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-3 rounded-full text-sm transition duration-300"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="bg-gray-400 hover:bg-gray-500 text-white font-bold py-1 px-3 rounded-full text-sm transition duration-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <strong className="text-blue-700">Content:</strong> {item.content} <br />
                      (Context: {item.contextSlide})
                      <span className="text-sm text-gray-500 ml-2">
                        {item.timestamp ? new Date(item.timestamp.seconds * 1000).toLocaleString() : 'N/A'}
                      </span>
                      <div className="flex justify-end space-x-2 mt-2">
                        <button
                          onClick={() => handleStartEdit(item)}
                          className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-1 px-3 rounded-full text-sm transition duration-300"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onDelete(item.id)}
                          className="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-3 rounded-full text-sm transition duration-300"
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-600">You haven't submitted any questions, comments, or feature requests yet. Use the 'Question/Comment/Feature Request' button to get started!</p>
          )}
          <div className="flex justify-end mt-6">
            <button
              onClick={onClose}
              className="bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-full transition duration-300 transform hover:scale-105"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  // New CMS Link Modal Component
  const CmsLinkModal = ({ show, onClose }) => {
    if (!show) return null;
    return (
      <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
          <h3 className="text-2xl font-bold text-gray-800 mb-4">Content Management System</h3>
          <p className="text-gray-700 mb-6">
            This is where a link to your external Headless CMS would go.
            Math teachers could log in here to add, edit, and manage instructional slides and practice problems.
            The content would then automatically sync with this learning app.
          </p>
          <button
            onClick={onClose}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full transition duration-300 transform hover:scale-105"
          >
            Got It!
          </button>
        </div>
      </div>
    );
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 p-8 font-sans">
      <h1 className="text-5xl font-extrabold text-center text-blue-900 mb-12 drop-shadow-lg">
        Mastering Trinomial Factorization
      </h1>

      {/* Top Left CMS Icon */}
      <button
        onClick={() => setShowCmsLinkModal(true)}
        className="absolute top-4 left-4 bg-gray-700 hover:bg-gray-800 text-white p-3 rounded-lg shadow-md transition duration-300 transform hover:scale-110"
        title="Link to CMS"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25a2.25 2.25 0 0 1-2.25 2.25h-2.25A2.25 2.25 0 0 1 13.5 8.25V6ZM13.5 15.75A2.25 2.25 0 0 1 15.75 13.5H18a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" />
        </svg>
      </button>


      {/* Top Right Buttons for Interaction and Knowledge Graph */}
      <div className="flex justify-end space-x-4 mb-8">
        <button
          onClick={() => setShowKnowledgeGraphModal(true)}
          className="bg-teal-500 hover:bg-teal-600 text-white font-bold py-2 px-5 rounded-full shadow-md transition duration-300 transform hover:scale-105 text-sm"
        >
          Show My Clarifications
        </button>
        <button
          onClick={() => setShowMyInteractionsModal(true)}
          className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-5 rounded-full shadow-md transition duration-300 transform hover:scale-105 text-sm"
        >
          My Questions/Comments
        </button>
        <button
          onClick={() => setShowInteractionModal(true)}
          className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-5 rounded-full shadow-md transition duration-300 transform hover:scale-105 text-sm"
        >
          Question/Comment/Feature Request
        </button>
      </div>

      {loadingSlides ? (
        <div className="text-center text-2xl text-gray-700 mt-20">Loading slides from the cloud...</div>
      ) : (
        !showProblems ? (
          <div className="flex flex-col items-center">
            {/* Conditional rendering to ensure factorizationGems[currentGemIndex] is not undefined */}
            {factorizationGems.length > 0 && factorizationGems[currentGemIndex] ? (
              <FactorizationGem
                title={factorizationGems[currentGemIndex].title}
                content={factorizationGems[currentGemIndex].content}
                simpleAltContent={factorizationGems[currentGemIndex].simpleAltContent} // Pass simpleAltContent
                mathJaxReady={mathJaxReady} // Pass readiness state to child components
                onWordSelect={handleWordSelection} // Pass the word selection handler
                isSimpleAltMode={isSimpleAltMode} // Pass current toggle state
                onToggleSimpleAlt={() => setIsSimpleAltMode(prev => !prev)} // Pass toggle handler
              />
            ) : (
              <div className="text-center text-xl text-gray-600 my-8">No slide content available. Please try loading default slides.</div>
            )}
            <div className="flex space-x-4 mt-8">
              <button
                onClick={handlePrevGem}
                disabled={currentGemIndex === 0}
                className={`bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 px-8 rounded-full shadow-lg transition duration-300 transform ${
                  currentGemIndex === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'
                }`}
              >
                Previous
              </button>
              <button
                onClick={handleNextGem}
                disabled={factorizationGems.length === 0} // Only disable if no slides loaded
                className={`bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-full shadow-lg transition duration-300 transform ${
                  factorizationGems.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'
                }`}
              >
                {currentGemIndex === factorizationGems.length - 1 ? "Start Problems" : "Next Gem"}
              </button>
            </div>
            <button
              onClick={populateDefaultSlides}
              className="mt-8 bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-6 rounded-full shadow-md transition duration-300 transform hover:scale-105 text-sm"
            >
              Load Default Slides
            </button>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto">
            <h2 className="text-4xl font-bold text-center text-purple-800 mb-8">Practice Problems</h2>
            {problemStates.length > 0 && problemStates[currentProblemIndex] ? (
              <ProblemCard
                key={problemStates[currentProblemIndex].id} // Key is essential for React to manage list items
                problem={problemStates[currentProblemIndex]}
                onProblemUpdate={handleProblemUpdate} // Pass the new update handler
                mathJaxReady={mathJaxReady}
              />
            ) : (
              <div className="text-center text-xl text-gray-600 my-8">No problems available.</div>
            )}
            <div className="flex space-x-4 mt-8 justify-center">
              <button
                onClick={handlePrevProblem}
                disabled={currentProblemIndex === 0}
                className={`bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 px-8 rounded-full shadow-lg transition duration-300 transform ${
                  currentProblemIndex === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'
                }`}
              >
                Previous Problem
              </button>
              <button
                onClick={handleNextProblem}
                disabled={currentProblemIndex === problems.length - 1}
                className={`bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-full shadow-lg transition duration-300 transform ${
                  currentProblemIndex === problems.length - 1 ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'
                }`}
              >
                Next Problem
              </button>
            </div>
            <button
              onClick={() => setShowProblems(false)}
              className="mt-8 bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-8 rounded-full shadow-lg transition duration-300 transform hover:scale-105 mx-auto block"
            >
              Review Gems
            </button>
          </div>
        )
      )}

      {/* Selection Confirmation Message */}
      {showSelectionMessage && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-green-600 text-white py-3 px-6 rounded-full shadow-lg text-lg transition-opacity duration-300 opacity-95 z-50">
          {selectionMessageText}
        </div>
      )}

      {/* Interaction Modal */}
      {showInteractionModal && (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full">
            <h3 className="text-2xl font-bold text-gray-800 mb-4">Submit Your Question, Comment, or Feature Request</h3>
            <textarea
              className="w-full p-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-lg mb-4 placeholder-gray-500"
              rows="5"
              placeholder="Type your question, comment, or feature request here. What are you confused about? Do you need more background on a term, or are you stuck on a specific step? (e.g., 'What does GCF mean?', 'How do I find the two numbers for the AC method?', 'Can you add more examples for perfect square trinomials?')"
              value={interactionText}
              onChange={(e) => setInteractionText(e.target.value)}
            ></textarea>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowInteractionModal(false)}
                className="bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-full transition duration-300 transform hover:scale-105"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitInteraction}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full transition duration-300 transform hover:scale-105"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Knowledge Graph Modal */}
      {showKnowledgeGraphModal && (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-xl w-full">
            <h3 className="text-2xl font-bold text-gray-800 mb-4">My Clarifications</h3>
            {knowledgeGraphData.length > 0 ? (
              <ul className="list-disc list-inside text-gray-700 max-h-80 overflow-y-auto">
                {knowledgeGraphData.map((item, index) => (
                  <li key={item.id || index} className="mb-2">
                    <strong className="text-blue-700">{item.term}</strong> (from: {item.slideTitle})
                    <span className="text-sm text-gray-500 ml-2">
                      {item.timestamp ? new Date(item.timestamp.seconds * 1000).toLocaleString() : 'N/A'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-600">No terms selected for clarification yet. Select words on the slides to add them here!</p>
            )}
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowKnowledgeGraphModal(false)}
                className="bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-full transition duration-300 transform hover:scale-105"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* My Interactions Modal */}
      <MyInteractionsModal
        show={showMyInteractionsModal}
        onClose={() => setShowMyInteractionsModal(false)}
        interactions={myInteractionsData}
        onEdit={handleEditInteraction}
        onDelete={handleDeleteInteraction}
      />

      {/* CMS Link Modal */}
      <CmsLinkModal
        show={showCmsLinkModal}
        onClose={() => setShowCmsLinkModal(false)}
      />
    </div>
  );
};

export default App;
