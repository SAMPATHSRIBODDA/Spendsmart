// SpendSmart Data Structures & Algorithms (DSA) Engine
// This file contains standard, manual, non-native implementations of fundamental computer science DSA.

// ============================================================================
// 1. STACK IMPLEMENTATION
// Used for: "Undo Delete" functionality.
// Explanation: A Stack (LIFO - Last In First Out) is ideal here because the user 
// expects to undo the most recently deleted item first. We push deleted items 
// onto the stack, and pop them off to restore them.
// ============================================================================
export class Stack<T> {
  private items: T[] = [];

  // Pushes a deleted element onto the stack
  public push(item: T): void {
    this.items.push(item);
  }

  // Removes and returns the most recently deleted element (LIFO)
  public pop(): T | null {
    if (this.isEmpty()) return null;
    return this.items.pop()!;
  }

  // Inspects the most recently deleted element without removing it
  public peek(): T | null {
    if (this.isEmpty()) return null;
    return this.items[this.items.length - 1];
  }

  // Checks if the stack is empty
  public isEmpty(): boolean {
    return this.items.length === 0;
  }

  // Returns current size of the stack
  public size(): number {
    return this.items.length;
  }

  // Clears the stack
  public clear(): void {
    this.items = [];
  }
}

// ============================================================================
// 2. TRIE (PREFIX TREE) IMPLEMENTATION
// Used for: "Transaction Search" by title and category instantly while typing.
// Explanation: A Trie provides O(L) lookup times (where L is the prefix length) 
// and enables efficient auto-completion and search. We index each word of the 
// expense title (description) and category to enable fast word-prefix searching.
// ============================================================================
export class TrieNode<T> {
  public children: { [char: string]: TrieNode<T> } = {};
  public items: Set<T> = new Set<T>(); // Items that pass through or end at this node
}

export class Trie<T> {
  private root: TrieNode<T> = new TrieNode<T>();

  // Inserts an item into the Trie under the given indexable text
  public insert(text: string, item: T): void {
    const cleanText = text.toLowerCase().trim();
    if (!cleanText) return;

    // Index full text and individual words
    const words = cleanText.split(/\s+/);
    for (const word of words) {
      if (!word) continue;
      this.insertWord(word, item);
    }
  }

  private insertWord(word: string, item: T): void {
    let current = this.root;
    current.items.add(item);

    for (let i = 0; i < word.length; i++) {
      const char = word[i];
      if (!current.children[char]) {
        current.children[char] = new TrieNode<T>();
      }
      current = current.children[char];
      current.items.add(item);
    }
  }

  // Searches for items matching a prefix (handles multi-word search intersection)
  public search(prefix: string): T[] {
    const cleanPrefix = prefix.toLowerCase().trim();
    if (!cleanPrefix) return [];

    const words = cleanPrefix.split(/\s+/);
    let results: Set<T> | null = null;

    for (const word of words) {
      if (!word) continue;
      let current = this.root;
      let found = true;

      for (let i = 0; i < word.length; i++) {
        const char = word[i];
        if (!current.children[char]) {
          found = false;
          break;
        }
        current = current.children[char];
      }

      const matches = found ? current.items : new Set<T>();

      if (results === null) {
        results = new Set(matches);
      } else {
        // Intersect sets to satisfy multi-word search (e.g. "food burger")
        const intersection = new Set<T>();
        for (const item of results) {
          if (matches.has(item)) {
            intersection.add(item);
          }
        }
        results = intersection;
      }
    }

    return results ? Array.from(results) : [];
  }
}

// ============================================================================
// 3. MERGE SORT IMPLEMENTATION
// Used for: "Ledger Sorting" by amount, date, and category.
// Explanation: Merge Sort is a divide-and-conquer sorting algorithm. It guarantees 
// O(N log N) time complexity in all cases (best, worst, average) and is stable, 
// meaning it preserves the original relative order of items with equal values.
// We implement it manually and avoid JavaScript's native array.sort().
// ============================================================================
export type Comparator<T> = (a: T, b: T) => number;

export function mergeSort<T>(arr: T[], compare: Comparator<T>): T[] {
  if (arr.length <= 1) {
    return arr;
  }

  const mid = Math.floor(arr.length / 2);
  const left = mergeSort(arr.slice(0, mid), compare);
  const right = mergeSort(arr.slice(mid), compare);

  return merge(left, right, compare);
}

function merge<T>(left: T[], right: T[], compare: Comparator<T>): T[] {
  const result: T[] = [];
  let l = 0;
  let r = 0;

  while (l < left.length && r < right.length) {
    if (compare(left[l], right[r]) <= 0) {
      result.push(left[l]);
      l++;
    } else {
      result.push(right[r]);
      r++;
    }
  }

  while (l < left.length) {
    result.push(left[l]);
    l++;
  }

  while (r < right.length) {
    result.push(right[r]);
    r++;
  }

  return result;
}


// ============================================================================
// 6. QUEUE (FIFO) IMPLEMENTATION
// Used for: "Smart Notifications" and recommendations processing.
// Explanation: A Queue (FIFO - First In First Out) is used to enqueue notifications 
// and dequeue them in order of arrival, or process them sequentially to build the final list.
// ============================================================================
export class Queue<T> {
  private items: T[] = [];

  // Enqueues an item at the back of the queue
  public enqueue(item: T): void {
    this.items.push(item);
  }

  // Dequeues and returns the front item of the queue (FIFO)
  public dequeue(): T | null {
    if (this.isEmpty()) return null;
    return this.items.shift()!;
  }

  // Peeks at the front item without removing it
  public peek(): T | null {
    if (this.isEmpty()) return null;
    return this.items[0];
  }

  // Checks if the queue is empty
  public isEmpty(): boolean {
    return this.items.length === 0;
  }

  // Returns current size of the queue
  public size(): number {
    return this.items.length;
  }

  // Converts queue to an array for rendering
  public toArray(): T[] {
    return [...this.items];
  }

  // Clears the queue
  public clear(): void {
    this.items = [];
  }
}

// ============================================================================
// 4. MIN-HEAP PRIORITY QUEUE
// Used for: Priority-based sorting of items in backend and database indexing.
// Explanation: A binary Min-Heap allows extracting the minimum element in O(log N) 
// and inserting in O(log N) time.
// ============================================================================
export interface HeapNode<T> {
  key: number;
  value: T;
}

export class MinHeap<T> {
  private heap: HeapNode<T>[] = [];

  private getParentIndex(i: number) { return Math.floor((i - 1) / 2); }
  private getLeftChildIndex(i: number) { return 2 * i + 1; }
  private getRightChildIndex(i: number) { return 2 * i + 2; }

  private swap(i1: number, i2: number) {
    const temp = this.heap[i1];
    this.heap[i1] = this.heap[i2];
    this.heap[i2] = temp;
  }

  public insert(key: number, value: T): void {
    this.heap.push({ key, value });
    this.heapifyUp();
  }

  private heapifyUp(): void {
    let index = this.heap.length - 1;
    while (
      index > 0 &&
      this.heap[index].key < this.heap[this.getParentIndex(index)].key
    ) {
      this.swap(index, this.getParentIndex(index));
      index = this.getParentIndex(index);
    }
  }

  public extractMin(): HeapNode<T> | null {
    if (this.heap.length === 0) return null;
    if (this.heap.length === 1) return this.heap.pop()!;

    const min = this.heap[0];
    this.heap[0] = this.heap.pop()!;
    this.heapifyDown();
    return min;
  }

  private heapifyDown(): void {
    let index = 0;
    while (this.getLeftChildIndex(index) < this.heap.length) {
      let smallerChildIndex = this.getLeftChildIndex(index);
      const rightChildIndex = this.getRightChildIndex(index);

      if (
        rightChildIndex < this.heap.length &&
        this.heap[rightChildIndex].key < this.heap[smallerChildIndex].key
      ) {
        smallerChildIndex = rightChildIndex;
      }

      if (this.heap[index].key < this.heap[smallerChildIndex].key) {
        break;
      }

      this.swap(index, smallerChildIndex);
      index = smallerChildIndex;
    }
  }

  public size(): number {
    return this.heap.length;
  }

  public toSortedArray(): T[] {
    const sorted: T[] = [];
    const copyHeap = new MinHeap<T>();
    copyHeap.heap = [...this.heap];
    while (copyHeap.size() > 0) {
      const minNode = copyHeap.extractMin();
      if (minNode) {
        sorted.push(minNode.value);
      }
    }
    return sorted;
  }
}

