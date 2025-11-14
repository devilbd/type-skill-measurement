import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, interval } from 'rxjs';

@Component({
  selector: 'app-typing',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './typing.component.html',
  styleUrl: './typing.component.scss',
})
export class TypingComponent implements OnInit, OnDestroy {
  // A collection of texts for the test
  private textSnippets = [
    'The quick brown fox jumps over the lazy dog. This is a sample text for the typing speed test. Good luck!',
    'Never underestimate the power of a good book. Reading can transport you to new worlds and expand your horizons.',
    'Technology has revolutionized the way we live and work. The pace of innovation continues to accelerate every day.',
    'The sun always shines brightest after the rain. Remember that challenges are temporary and perseverance pays off.',
  ];
  private currentTextIndex = 0;

  // The text the user needs to type
  textToType = signal(this.textSnippets[this.currentTextIndex]);
  // State for the typing test
  timeLeft = signal(60);
  timerRunning = signal(false);
  testFinished = signal(false);
  wpm = signal(0);
  accuracy = signal(0);

  private timerSubscription: Subscription | undefined;
  private correctWordsCount = 0;
  private totalWordsTyped = 0;

  ngOnInit(): void {
    this.resetTest();
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

    this.updateWordStyles(inputValue);

    // Check if the user has completed the text
    if (inputValue.length >= this.textToType().length) {
      // A small delay to allow the last word to be styled
      setTimeout(() => this.loadNextText(inputElement), 100);
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

  private updateWordStyles(inputValue: string): void {
    const originalWords = this.textToType().split(' ');
    const typedWords = inputValue.trim().split(/\s+/);

    const currentWordIndex = typedWords.length - 1;

    originalWords.forEach((originalWord, index) => {
      const span = document.querySelector(`.word-${index}`) as HTMLElement;
      if (span) {
        const typedWord = typedWords[index];
        let className = `word word-${index}`;

        if (typedWord === undefined) {
          // Word has not been reached yet.
        } else if (index < currentWordIndex || (index === currentWordIndex && inputValue.endsWith(' '))) {
          // This is a completed word (not the active one).
          if (typedWord === originalWord) {
            className += ' correct';
          } else {
            className += ' incorrect';
          }
        } else {
          // This is the active word being typed.
          className += ' active';
          if (!originalWord.startsWith(typedWord)) {
            // The user has typed something that makes the word incorrect.
            className += ' incorrect';
          }
        }

        // The very first word needs the 'active' class before any input.
        if (index === 0 && inputValue.trim() === '') {
          className = `word word-0 active`;
        }

        span.className = className;
      }
    });

    // Update the total correct words count only after a word is fully typed (space is pressed)
    if (inputValue.endsWith(' ')) {
      const lastTypedWordIndex = typedWords.length - 2; // The word just completed
      if (lastTypedWordIndex >= 0) {
        const originalWord = originalWords[lastTypedWordIndex];
        this.totalWordsTyped++; // Increment total words attempted
        const typedWord = typedWords[lastTypedWordIndex];
        if (originalWord === typedWord) {
          this.correctWordsCount++;
        }
      }
    }
  }

  private loadNextText(inputElement: HTMLTextAreaElement): void {
    this.currentTextIndex = (this.currentTextIndex + 1) % this.textSnippets.length;
    this.textToType.set(this.textSnippets[this.currentTextIndex]);
    inputElement.value = '';

    // Reset styles for the new text
    // A timeout ensures the DOM has updated with the new words
    setTimeout(() => {
      // Trigger a style update for the new, empty text state
      this.updateWordStyles('');
    }, 0);
  }

  resetTest(): void {
    this.currentTextIndex = 0;
    this.textToType.set(this.textSnippets[this.currentTextIndex]);
    this.timeLeft.set(60);
    this.timerRunning.set(false);
    this.testFinished.set(false);
    this.wpm.set(0);
    this.accuracy.set(0);
    this.timerSubscription?.unsubscribe();
    this.correctWordsCount = 0;
    this.totalWordsTyped = 0;

    // You would also clear the textarea and reset word styles here
  }

  ngOnDestroy(): void {
    this.timerSubscription?.unsubscribe();
  }
}