import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class TextProviderService {
  private readonly words = [
    'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'I',
    'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
    'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
    'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
    'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me'
  ];

  getRandomText(wordCount: number = 30): string {
    const randomWords = Array.from({ length: wordCount }, () => 
        this.words[Math.floor(Math.random() * this.words.length)]
    );
    return randomWords.join(' ');
  }
}