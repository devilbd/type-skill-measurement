import { Component, OnDestroy, OnInit, ViewChild, ViewChildren, ElementRef, WritableSignal, computed, signal, AfterViewInit, QueryList } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { Subscription, interval } from 'rxjs';

type Theme = 'dark' | 'green' | 'space';
type WordState = 'default' | 'correct' | 'incorrect' | 'active';

@Component({
  selector: 'app-typing',
  standalone: true,
  imports: [CommonModule, NgClass],
  templateUrl: './typing.component.html', // Assuming you'll display level/points in HTML
  styleUrl: './typing.component.scss',
})
export class TypingComponent implements OnInit, OnDestroy, AfterViewInit {
  // --- Theme Management ---
  private themes: Theme[] = ['dark', 'green', 'space'];
  private currentThemeIndex = 0;
  currentTheme = signal<Theme>(this.themes[this.currentThemeIndex]);

  // Reference to the textarea element
  @ViewChild('typingInput') typingInput!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('textDisplay') textDisplay!: ElementRef<HTMLDivElement>;
  @ViewChildren('wordElement') wordElements!: QueryList<ElementRef<HTMLSpanElement>>;

  // A collection of texts for the test
  private textSnippets = [
    'The concept of artificial intelligence has captivated the human imagination for decades. From the early days of simple algorithms to the complex neural networks of today, the journey has been nothing short of extraordinary. As machines learn to process information in ways that mimic the human brain, we are witnessing a transformation in how we interact with technology. The potential applications are vast, ranging from healthcare diagnostics to autonomous vehicles, promising a future where efficiency and innovation go hand in hand.',
    'In the heart of the bustling city, amidst the cacophony of honking cars and hurried footsteps, there lies a hidden garden. It is a sanctuary of peace, where the air is filled with the scent of blooming jasmine and the gentle sound of a trickling fountain. Here, time seems to slow down, allowing one to escape the relentless pace of modern life. It serves as a reminder that even in the most chaotic of environments, moments of tranquility can be found if one knows where to look.',
    'Software engineering is more than just writing code; it is an art form that requires creativity, logic, and a deep understanding of problem-solving. Every line of code is a building block in a larger structure, designed to perform specific tasks with precision and efficiency. The challenge lies not only in making it work but in making it maintainable and scalable. As technology evolves, so too must the skills of the engineer, constantly adapting to new languages, frameworks, and methodologies.',
    'The universe is a vast and mysterious expanse, filled with wonders that we are only just beginning to understand. From the swirling nebulae that birth new stars to the black holes that devour everything in their path, the cosmos is a testament to the power of nature. Exploring these celestial bodies helps us answer fundamental questions about our existence and our place in the grand scheme of things. It is a journey of discovery that pushes the boundaries of human knowledge and inspires generations to look up at the stars with wonder.',
  ];
  private currentTextIndex = 0;

  // The text the user needs to type
  textToType = signal(this.textSnippets[this.currentTextIndex]);
  // An array of signals to hold the state of each word for reactive styling
  wordStates: WritableSignal<WordState>[] = [];
  // A computed signal for the words array to avoid splitting on every change detection
  words = computed(() => this.textToType().split(' '));

  // State for the typing test
  timeLeft = signal(60);
  timerRunning = signal(false);
  testFinished = signal(false);
  wpm = signal(0);
  accuracy = signal(0);

  // Leveling System State
  currentLevel = signal(1);
  currentPoints = signal(0);
  pointsForNextLevel = signal(0); // Will be initialized in ngOnInit

  // Leveling System Configuration
  private BASE_POINTS_FOR_LEVEL_2 = 100; // Points needed to reach Level 2 (from Level 1)
  private LEVEL_THRESHOLD_MULTIPLIER = 1.5; // How much harder each subsequent level is

  // Letter values for scoring (Scrabble-like)
  private readonly LETTER_VALUES: { [key: string]: number } = {
    'A': 1, 'E': 1, 'I': 1, 'O': 1, 'U': 1, 'L': 1, 'N': 1, 'R': 1, 'S': 1, 'T': 1,
    'D': 2, 'G': 2,
    'B': 3, 'C': 3, 'M': 3, 'P': 3,
    'F': 4, 'H': 4, 'V': 4, 'W': 4, 'Y': 4,
    'K': 5,
    'J': 8, 'X': 8,
    'Q': 10, 'Z': 10,
  };
  private readonly MIN_WORD_LENGTH_FOR_POINTS = 3;
  private readonly LENGTH_BONUS_PER_EXTRA_LETTER = 0.15;

  private timerSubscription: Subscription | undefined;
  private correctWordsCount = 0;
  private totalWordsTyped = 0;

  // Helper for logging (can be removed in production)
  private logStatus(): void {
    console.log(
      `Level: ${this.currentLevel()} | ` +
      `Points: ${this.currentPoints()} / ${this.pointsForNextLevel()} | ` +
      `WPM: ${this.wpm()} | ` +
      `Accuracy: ${this.accuracy()}%`
    );
  }

  ngOnInit(): void {
    this.resetTest();
    this.initializeWordStates();
    // Initialize points needed for the first level-up
    this.updatePointsForNextLevel();
    this.logStatus();
  }

  ngAfterViewInit(): void {
    // Ensure the input is focused after the view has been initialized.
    this.typingInput.nativeElement.focus();
  }

  onInput(event: Event): void {
    const inputElement = event.target as HTMLTextAreaElement;
    const inputValue = inputElement.value;

    // Start the timer on the first character typed
    if (!this.timerRunning() && !this.testFinished()) {
      this.startTimer();
    }

    if (this.testFinished()) {
      // Prevent typing after the test is over
      inputElement.value = inputValue.substring(0, inputValue.lastIndexOf(' ') + 1);
      return;
    }

    this.processInput(inputValue);

    // Check if the user has completed the text
    if (inputValue.length >= this.textToType().length) {
      // A small delay to allow the last word to be styled
      setTimeout(() => this.loadNextText(inputElement), 100);
    } else {
      // Auto-scroll to the active word only if space or enter was pressed
      if (inputValue.endsWith(' ') || inputValue.endsWith('\n')) {
        setTimeout(() => this.scrollToActiveWord(), 0);
      }
    }
  }

  private startTimer(): void {
    this.timerRunning.set(true);
    this.timerSubscription = interval(1000).subscribe(() => {
      this.timeLeft.set(this.timeLeft() - 1);
      if (this.timeLeft() === 0) {
        this.endTest();
      }
    });
  }

  private endTest(): void {
    this.timerRunning.set(false);
    this.testFinished.set(true);
    this.timerSubscription?.unsubscribe();
    this.calculateResults();
  }

  private calculateResults(): void {
    // WPM is the number of correct words typed in one minute.
    this.wpm.set(this.correctWordsCount);

    // Calculate accuracy based on words
    const accuracyValue = this.totalWordsTyped > 0 ? (this.correctWordsCount / this.totalWordsTyped) * 100 : 0;
    this.accuracy.set(Math.round(accuracyValue));
  }

  private processInput(inputValue: string): void {
    const originalWords = this.words();
    const typedWords = inputValue.trim().split(/\s+/);
    const currentWordIndex = typedWords.length - 1;

    this.wordStates.forEach((state, index) => {
      const originalWord = originalWords[index];
      const typedWord = typedWords[index];

      if (typedWord === undefined && index > 0) {
        state.set('default'); // Not yet typed
      } else if (index < currentWordIndex || (index === currentWordIndex && inputValue.endsWith(' '))) {
        // Completed word
        state.set(typedWord === originalWord ? 'correct' : 'incorrect');
      } else if (index === currentWordIndex) {
        // Active word
        if (originalWord.startsWith(typedWord)) {
          state.set('active');
        } else {
          state.set('incorrect');
        }
      }
    });

    // Set first word to active if input is empty
    if (inputValue.trim() === '' && this.wordStates.length > 0) {
      this.wordStates[0].set('active');
    }

    // Update the total correct words count only after a word is fully typed (space is pressed)
    if (inputValue.endsWith(' ')) {
      const lastTypedWordIndex = typedWords.length - 2; // The word just completed
      if (lastTypedWordIndex >= 0) {
        const originalWord = originalWords[lastTypedWordIndex];
        this.totalWordsTyped++; // Increment total words attempted
        const typedWord = typedWords[lastTypedWordIndex];
        if (originalWord === typedWord) {
          this.correctWordsCount++;
          // Award points for the successfully typed word
          const pointsGained = this.calculatePointsForWord(originalWord);
          this.currentPoints.update(points => points + pointsGained);
          console.log(`+${pointsGained} points for '${originalWord}'`);
          this.checkLevelUp();
        }
      }
    }
  }

  /**
   * Calculates the points for a given word based on letter rarity and length bonus.
   * This defines the "typing context" for scoring.
   * @param word The word to score.
   * @returns The points awarded for the word.
   */
  private calculatePointsForWord(word: string): number {
    if (!word || word.trim().length < this.MIN_WORD_LENGTH_FOR_POINTS) {
      return 0; // Words too short don't get points
    }

    const upperWord = word.toUpperCase();
    let baseScore = 0;
    for (const char of upperWord) {
      baseScore += this.LETTER_VALUES[char] || 0; // Default to 0 for non-alphabetic or unknown chars
    }

    // Apply a length bonus: longer words are worth more than just the sum of their letters.
    const lengthBonusFactor = 1.0 + (upperWord.length - this.MIN_WORD_LENGTH_FOR_POINTS) * this.LENGTH_BONUS_PER_EXTRA_LETTER;

    const finalScore = Math.floor(baseScore * lengthBonusFactor);
    return Math.max(1, finalScore); // Ensure a minimum of 1 point for valid words
  }

  private checkLevelUp(): void {
    while (this.currentPoints() >= this.pointsForNextLevel()) {
      console.log(`---------------------------------`);
      console.log(`LEVEL UP! You've reached Level ${this.currentLevel() + 1}!`);
      console.log(`---------------------------------`);
      this.currentLevel.update(level => level + 1);
      this.currentPoints.update(points => points - this.pointsForNextLevel()); // Carry over excess points
      this.updatePointsForNextLevel();
    }
    this.logStatus();
  }

  private loadNextText(inputElement: HTMLTextAreaElement): void {
    this.currentTextIndex = (this.currentTextIndex + 1) % this.textSnippets.length;
    this.textToType.set(this.textSnippets[this.currentTextIndex]);
    inputElement.value = '';
    this.initializeWordStates();
  }

  private initializeWordStates(): void {
    this.wordStates = this.words().map(() => signal<WordState>('default'));
    if (this.wordStates.length > 0) {
      this.wordStates[0].set('active'); // Set the first word to active
    }
  }

  resetTest(): void {
    // Stop any running timer
    this.timerSubscription?.unsubscribe();
    this.timerRunning.set(false);

    // Reset leveling state
    this.currentLevel.set(1);
    this.currentPoints.set(0);
    this.currentTextIndex = 0;
    this.textToType.set(this.textSnippets[this.currentTextIndex]);
    this.timeLeft.set(60);
    this.timerRunning.set(false);
    this.testFinished.set(false);
    this.wpm.set(0);
    this.accuracy.set(0);
    this.correctWordsCount = 0;
    this.totalWordsTyped = 0;

    this.initializeWordStates();
    this.updatePointsForNextLevel(); // Recalculate points for next level based on new currentLevel
    this.logStatus();

    // Focus the input field after resetting
    setTimeout(() => {
      this.typingInput.nativeElement.value = '';
      this.typingInput.nativeElement.focus();
    });
  }

  /**
   * Calculates the points required to reach a specific level from the start of the previous level.
   * @param targetLevel The level for which to calculate the threshold (e.g., 2 for the first level-up).
   * @returns The total points required to go from (targetLevel - 1) to targetLevel.
   */
  private getPointsRequiredForLevel(targetLevel: number): number {
    if (targetLevel <= 1) return 0; // No points needed to be at Level 1
    // Level 2 needs BASE_POINTS_FOR_LEVEL_2 (multiplier power 0)
    return Math.floor(this.BASE_POINTS_FOR_LEVEL_2 * Math.pow(this.LEVEL_THRESHOLD_MULTIPLIER, targetLevel - 2));
  }

  private updatePointsForNextLevel(): void {
    const pointsNeeded = this.getPointsRequiredForLevel(this.currentLevel() + 1);
    this.pointsForNextLevel.set(pointsNeeded);
  }

  ngOnDestroy(): void {
    this.timerSubscription?.unsubscribe();
  }

  private scrollToActiveWord(): void {
    if (!this.textDisplay || !this.wordElements) return;

    const activeWordIndex = this.wordStates.findIndex(state => state() === 'active');
    if (activeWordIndex === -1) {
      console.log('No active word found for scrolling.');
      return;
    }

    const wordElement = this.wordElements.get(activeWordIndex)?.nativeElement;
    const container = this.textDisplay.nativeElement;

    if (wordElement && container) {
      const wordRect = wordElement.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      // Calculate the word's position relative to the container's viewport
      const relativeTop = wordRect.top - containerRect.top;
      const containerHeight = containerRect.height;

      // Define safe zone: Top 60% of the container
      // If the word is below this zone (i.e., in the bottom 40%), scroll it to center.
      // Also scroll if it's above the viewport (negative relativeTop).
      const threshold = containerHeight * 0.6;

      if (relativeTop > threshold || relativeTop < 0) {
        console.log(`Active word is outside safe zone (top: ${relativeTop.toFixed(0)}, threshold: ${threshold.toFixed(0)}). Scrolling to center.`);
        wordElement.scrollIntoView({ block: 'center', behavior: 'smooth' });
      } else {
        console.log(`Active word is in safe zone. No scroll needed.`);
      }
    } else {
      console.log(`Could not find element for active word at index ${activeWordIndex}`);
    }
  }
}