import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TypingComponent } from './typing/typing.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TypingComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
    
}
