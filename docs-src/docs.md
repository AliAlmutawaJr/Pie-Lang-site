# Pie documentation

<!-- Pie is an interpreted language that leaves almost everything to you. There
are no built-in operators, no `if`, and no `null`. Every piece of syntax is an
expression. -->

These docs go from your first line of Pie to the strange corners. Every example
with a **Run** button opens in the playground, so you can poke at it.

## Getting started

### Hello, world

```pie run
__builtin_print("Hello, world!");
```

```output
Hello, world!
```

Anything whose name starts with `__builtin_` is provided by the interpreter.
Those names are long on purpose: you are meant to give them nicer names
yourself.

```pie run
print = __builtin_print;
print("Much better.");
```

```output
Much better.
```

Every expression ends with a semicolon, including the last one in a block.

### Running Pie

Install Pie from the [releases page](https://github.com/AliAlmutawaJr/Pie/releases)
or build it from source (see [Installing](#installing)). Then:

| Command | What it does |
| --- | --- |
| `pie file.pie` | Run a file |
| `pie` | Start the REPL |
| `pie -c "code"` | Run code passed on the command line |
| `pie -t file.pie` | Print the tokens before running |
| `pie -a file.pie` | Print the parsed program before running |
| `pie -n file.pie` | Parse only, don't run |
| `pie -v` | Print the version |

### The starter operators

Pie ships with zero operators. Even `+` is something you define:

```pie run
infix + = (a, b) => __builtin_add(a, b);
__builtin_print(1 + 2);
```

```output
3
```

Most examples below use a small set of operators so they can focus on one idea
at a time. Examples marked **uses the starter operators** run with this code
in front of them:

```pie
.: Starter operators: Pie has none built in, so we make our own.
print = __builtin_print;

infix + = (a, b) => __builtin_add(a, b);
infix + = (a: String, b: String) => __builtin_concat(a, b);
infix - = (a, b) => __builtin_sub(a, b);
infix * = (a, b) => __builtin_mul(a, b);
infix / = (a, b) => __builtin_div(a, b);
infix % = (a, b) => __builtin_mod(a, b);
prefix - = (x) => __builtin_neg(x);

infix == = (a, b) => __builtin_eq(a, b);
infix != = (a, b) => __builtin_not(__builtin_eq(a, b));
infix <  = (a, b) => __builtin_lt(a, b);
infix <= = (a, b) => __builtin_leq(a, b);
infix >  = (a, b) => __builtin_gt(a, b);
infix >= = (a, b) => __builtin_geq(a, b);

infix(&&) and = (a, b) => __builtin_and(a, b);
infix(||) or  = (a, b) => __builtin_or(a, b);
prefix(!) not = (x) => __builtin_not(x);

mixfix(LOW +) if : then : else : =
    (cond, `yes`, `no`) => __builtin_eval(__builtin_conditional(cond, yes, no));
```

By the end of the [Operators](#operators) chapter, you'll understand every line
of it.

### Comments

```pie run
.: A line comment starts with a dot and a colon.

.::
   A block comment can span
   as many lines as you like.
::.

__builtin_print("comments are ignored");
```

```output
comments are ignored
```

## Values

### Numbers

`Int`s have arbitrary precision, so they never overflow. `Double`s are regular
64-bit floating point numbers.

```pie run+
print(2 * 3);
print(10 / 4);
print(10.0 / 4);
print(__builtin_pow(2, 100));
```

```output
6
2
2.500000
1267650600228229401496703205376
```

Dividing two `Int`s gives an `Int`. Use a `Double` on either side to get a
`Double`.

> **There are no negative literals.** Names in Pie can contain symbols, so
> `-3` is a *name*, not a number. Write `- 3` (with the starter `prefix -`) or
> `__builtin_neg(3)`. The same goes for operators in general: put spaces around
> them, because `n-1` is a single name.

```pie run+
n = 10;
print(n - 1);
print(- 3);
```

```output
9
-3
```

### Booleans

`true` and `false`. Combine them with `__builtin_and`, `__builtin_or` and
`__builtin_not`, or with the starter operators `and`, `or` and `not`.

```pie run+
print(1 < 2 and 2 < 3);
print(not true or false);
```

```output
true
false
```

### Strings

Strings use double quotes and the usual escapes (`\n`, `\t`, `\"`, `\\`).
Any `{expression}` inside a string is evaluated and spliced in, so every string
is a format string. Escape a brace with `\{`. Keep the expressions inside
braces short; for anything with commas, like a call with two arguments, store
the result in a variable first.

```pie run+
name = "Pie";
age = 3;
print("{name} is {age} years old. Next year: {age + 1}.");
print("Literal braces: \{like this\}");
```

```output
Pie is 3 years old. Next year: 4.
Literal braces: {like this}
```

### Lists

A list is a comma-separated sequence in braces. `{}` is the empty list.

```pie run+
fruits = {"apple", "cherry", "pecan"};
print(fruits);
print(__builtin_len(fruits));
print(__builtin_get(fruits, 1));

__builtin_push(fruits, "pumpkin");
__builtin_set(fruits, 0, "blueberry");
print(fruits);
```

```output
{apple, cherry, pecan}
3
cherry
{blueberry, cherry, pecan, pumpkin}
```

### Maps

A map is a set of `key: value` pairs in braces. `{:}` is the empty map. Keys can
be any value.

```pie run+
stock = {"apple": 3, "cherry": 0};
print(__builtin_get(stock, "apple"));

__builtin_set(stock, "cherry", 12);
print(__builtin_get(stock, "cherry"));
print(__builtin_len(stock));
```

```output
3
12
2
```

Maps don't keep insertion order, so printing a whole map can list its pairs in
any order.

### Blocks

A block is a list of expressions in braces. It runs them in order and becomes
the value of the last one.

```pie run+
answer = {
    a = 40;
    b = 2;
    a + b;
};
print(answer);
```

```output
42
```

> `{ }` is an empty *list*, not an empty block. A block always has at least one
> expression followed by a `;`.

## Variables

### Assignment

The first assignment to a name declares it. Later assignments change it.

```pie run+
x = 1;
x = "now a string";
print(x);
```

```output
now a string
```

### Types

Add a type after the name to restrict what it can hold. A name without a type
has type `Any`.

```pie error
count: Int = 1;
count = 2;
count = "three";
```

Running this stops at the last line:

```output
error: In assignment: count = "three"
Type mis-match! Expected: Int, got: String
```

Writing a type again declares a *new* variable that replaces the old one, even
with a different type:

```pie run+
value: Int = 5;
value: String = "five";
print(value);
```

```output
five
```

### Inferred types

`:=` declares a variable whose type is the type of its value.

```pie run+
x := 10;
print(__builtin_decltype(x));

y = 10;
print(__builtin_decltype(y));
```

```output
Int
Any
```

`__builtin_type` gives the type of a value. `__builtin_decltype` gives the
declared type of a variable.

### Scopes

Blocks create scopes. Assigning to a name that already exists outside changes
the outer variable. Adding a type declares a fresh one that only lives inside
the block.

```pie run+
x = 5;
y = "hi";
{
    x = 10;
    y: Any = "bye";
};
print(x);
print(y);
```

```output
10
hi
```

Prefix a name with `::` to reach the global variable, skipping anything in
between that shadows it.

```pie run+
x = "global";
f = () => {
    x: String = "local";
    ::x = "changed from inside";
    x;
};
print(f());
print(x);
```

```output
local
changed from inside
```

### Assign to anything

The left side of `=` can be *any* expression. Pie remembers the assignment
and uses it whenever that exact expression shows up again.

```pie run+
1 = 2;
print(1);
print(1 + 1);

2 + 2 = 5;
print(2 + 2);

"Hello" = "Goodbye";
print("Hello");
```

```output
2
4
5
Goodbye
```

Like any other variable, the change only lasts until the end of the block.

```pie run+
{
    1 = 100;
    print(1);
};
print(1);
```

```output
100
1
```

Only plain names can have a type annotation. `1: Int = 5;` is an error.

## Functions

### Closures

A function is a parameter list, `=>` and a body.

```pie run+
square = (x) => x * x;
print(square(7));

greet = (name) => {
    message = "Hello, {name}!";
    print(message);
};
greet("Pie");
```

```output
49
Hello, Pie!
```

Functions are values like any other. There is no `return`: a function gives
back the value of its body.

### Typed parameters

Parameters and the result can have types. Anything left out is `Any`.

```pie run+
area = (w: Int, h: Int): Int => w * h;
print(area(3, 4));
```

```output
12
```

```pie error+
area = (w: Int, h: Int): Int => w * h;
area(3, "four");
```

### Named arguments

Any argument can be passed by name, in any order, and mixed with positional
ones.

```pie run+
describe = (name, food, count) => print("{name} ate {count} {food}");

describe("Ali", "pies", 3);
describe(count = 2, food = "tarts", name = "Pie");
describe(food = "muffins", "Sam", 9);
```

```output
Ali ate 3 pies
Pie ate 2 tarts
Sam ate 9 muffins
```

### Default values

Parameters can have default values. A default can use the parameters before
it.

```pie run+
slice = (size, count = 8) => print("{count} slices of {size}");
slice("large");
slice("small", 4);

pair = (a, b = a) => print(a, b);
pair(1);
pair(1, 2);
```

```output
8 slices of large
4 slices of small
1 1
1 2
```

### Variadic functions

A parameter written `...name` collects any number of arguments into a *pack*.
A function can have one, anywhere in its parameter list.

```pie run+
first = (head, ...rest) => head;
last  = (...init, end) => end;

print(first(1, 2, 3));
print(last(1, 2, 3));

count = (...things) => __builtin_len(things);
print(count());
print(count("a", "b", "c"));
```

```output
1
3
0
3
```

Put `...` after a pack to spread it back out into separate arguments:

```pie run+
add3 = (a, b, c) => a + b + c;
forward = (...args) => add3(args...);
print(forward(1, 2, 3));
```

```output
6
```

Packs get their own chapter: [Packs and folds](#packs-and-folds).

### Currying

Call a function with fewer arguments than it needs and you get back a function
waiting for the rest.

```pie run+
add = (a, b) => a + b;
addTen = add(10);
print(addTen(5));
print(add(1)(2));
```

```output
15
3
```

### Calling right away

A function literal followed by `(...)` runs immediately.

```pie run
() => {
    __builtin_print("I ran!");
}();
```

```output
I ran!
```

### Everything is callable

Calling a value that isn't a function just gives the value back, as if it were
a function with no parameters.

```pie run+
x = 5;
print(x());
```

```output
5
```

### Destructuring parameters

A parameter can be a pattern that pulls apart its argument. Patterns are
explained in [Unpacking](#unpacking).

```pie run+
sum = ({a, b}) => a + b;
print(sum({3, 4}));

Point = class { x = 0; y = 0; };
norm1 = ({x, y}: Point) => x + y;
print(norm1(Point(2, 5)));
```

```output
7
7
```

## Operators

### Defining operators

An operator is a function bound to a symbol (or a word) with one of five
keywords. The keyword says where the operator goes:

| Kind | Looks like | Function takes |
| --- | --- | --- |
| `prefix` | `- x` | 1 argument |
| `infix` | `a + b` | 2 arguments |
| `suffix` | `n !` | 1 argument |
| `exfix` | `\| x \|` | 1 argument |
| `mixfix` | `if a then b else c` | one per `:` |

```pie run
print = __builtin_print;

infix + = (a, b) => __builtin_add(a, b);
prefix(!) double = (x) => x + x;
suffix([]) squared = (x) => __builtin_mul(x, x);

print(double 21);
print(5 squared);
```

```output
42
25
```

Operator names can be symbols, words or a mix of both. Because operators are
just names, any symbol you haven't defined is free to use as a variable name.

### Precedence

The parentheses after the keyword set the precedence. Use an existing operator
to say "the same as this one". When the operator is one Pie already knows
(like `+` or `*`), you can leave the precedence out.

```pie run
print = __builtin_print;

infix(+) plus  = (a, b) => __builtin_add(a, b);
infix(*) times = (a, b) => __builtin_mul(a, b);

print(1 plus 2 times 3);
```

```output
7
```

Add `+` or `-` to nudge it one step higher or lower. Nudges never cross into
the next level: `* -` is still above `+`.

```pie run
print = __builtin_print;

infix + = (a, b) => __builtin_add(a, b);
infix(+ +) times = (a, b) => __builtin_mul(a, b);

print(1 + 2 times 3);
```

```output
7
```

Your own operators can be precedence levels too: `infix(plus +) ...`. The
special levels `LOW` and `HIGH` sit below and above everything else and are
always nudged: `LOW +` or `HIGH -`.

The built-in precedence levels, from lowest to highest:

| Level | Operators |
| --- | --- |
| Assignment | `=` |
| Logical or | `\|\|` |
| Logical and | `&&` |
| Bitwise or | `\|` |
| Bitwise xor | `^` |
| Bitwise and | `&` |
| Equality | `==` `!=` |
| Comparison | `<` `<=` `>` `>=` |
| Three-way | `<=>` |
| Shift | `<<` `>>` |
| Additive | `+` `-` |
| Multiplicative | `*` `/` `%` |
| Unary | `!` `~` |
| Subscript | `[]` |
| Call | `()` |
| Scope | `::` |

### Exfix operators

An exfix operator wraps its argument. Separate the opening and closing names
with a `:`.

```pie run+
exfix | : | = (x) => if x < 0 then - x else x;
print(| 3 - 10 |);
```

```output
7
```

### Mixfix operators

A mixfix operator is a sentence with holes. Write a `:` wherever an argument
goes.

```pie run+
mixfix(LOW +) clamp : between : and : =
    (x, lo, hi) => if x < lo then lo else if x > hi then hi else x;

print(clamp 15 between 0 and 10);
print(clamp 5 between 0 and 10);
```

```output
10
5
```

The starter `if : then : else :` is a mixfix operator. It uses
[syntax parameters](#syntax-parameters) so that only one branch runs.

### Overloading

Define an operator more than once with different parameter types, and Pie
picks the definition that fits the arguments.

```pie run
print = __builtin_print;

infix + = (a: Int, b: Int) => __builtin_add(a, b);
infix + = (a: String, b: String) => __builtin_concat(a, b);

print(1 + 2);
print("Pie" + " is sweet");
```

```output
3
Pie is sweet
```

### Operators are scoped

An operator only exists in the block where it was defined, just like a variable.

```pie run
{
    infix + = (a, b) => __builtin_add(a, b);
    __builtin_print(1 + 2);
};
__builtin_print("+ is gone out here");
```

```output
3
+ is gone out here
```

Operators can also be recursive:

```pie run
suffix ! = (n) => __builtin_conditional(
    __builtin_lt(n, 2),
    1,
    __builtin_mul(n, __builtin_sub(n, 1) !)
);

__builtin_print(20 !);
```

```output
2432902008176640000
```

## Control flow

### Conditionals

The only built-in conditional is `__builtin_conditional(cond, then, else)`.
It only evaluates the branch it picks.

```pie run
age = 12;
__builtin_print(__builtin_conditional(__builtin_geq(age, 13), "teen", "kid"));
```

```output
kid
```

That's enough to build any `if` you like. The starter operators define
`if : then : else :`:

```pie run+
fib = (n) => if n < 2 then n else fib(n - 1) + fib(n - 2);
print(fib(20));

grade = (score) =>
    if score >= 90 then "A"
    else if score >= 80 then "B"
    else "keep practicing";

print(grade(95));
print(grade(70));
```

```output
6765
A
keep practicing
```

For a `match`-based alternative, see [Pattern matching](#pattern-matching).

### Loops

There is one loop keyword, `loop`. What it does depends on what you give it.

| You give it | It runs |
| --- | --- |
| an `Int` `n` | `n` times, counting from `0` |
| a `Bool` | while the condition is `true` |
| a list, string or pack | once per element |
| an object | once per value from its `next()` |
| nothing | forever, until `break` |

```pie run+
loop 3 {
    print("hip hip");
};

loop i : 3 {
    print("i = {i}");
};
```

```output
hip hip
hip hip
hip hip
i = 0
i = 1
i = 2
```

`name :` before the operand names the loop variable. The braces are optional
when the body is a single expression.

```pie run+
loop fruit : {"apple", "cherry"} print("I like {fruit} pie");

n = 3;
loop n > 0 {
    print(n);
    n = n - 1;
};
```

```output
I like apple pie
I like cherry pie
3
2
1
```

### Break and continue

`break value` stops the loop, and the loop evaluates to `value`. `continue`
skips to the next round.

```pie run+
firstBig = loop x : {3, 8, 12, 20} {
    if x > 10 then (break x) else 0;
};
print(firstBig);

loop i : 5 {
    if i % 2 == 0 then (continue) else 0;
    print(i);
};
```

```output
12
1
3
```

`break` and `continue` grab everything after them, so wrap them in parentheses
when they sit inside a bigger expression like `if ... then ... else`.

A loop that finishes without `break` evaluates to the value of its last round.

### Iterators

Any object with a `hasNext()` method and a `next()` method can be looped over.

```pie run+
Countdown = class {
    from = 0;

    hasNext = () => from > 0;
    next = () => {
        current = from;
        from = from - 1;
        current;
    };
};

loop n : Countdown(3) print(n);
print("liftoff");
```

```output
3
2
1
liftoff
```

### Comprehensions

Put a loop inside braces with `=>` to build a list, or with `key: value` to
build a map. A `,` after the loop operand adds a filter.

```pie run+
squares = { loop i : 6 => i * i };
print(squares);

odds = { loop i : 10, i % 2 == 1 => i };
print(odds);

doubled = { loop i : 3 => i : i * 2 };
print(__builtin_get(doubled, 2));
```

```output
{0, 1, 4, 9, 16, 25}
{1, 3, 5, 7, 9}
4
```

### Defer

`__builtin_defer(expr)` runs `expr` when the current function, loop round or
program ends. Deferred expressions run last-in, first-out.

```pie run
cleanup = () => {
    __builtin_defer(__builtin_print("closing the oven"));
    __builtin_defer(__builtin_print("taking the pie out"));
    __builtin_print("baking");
};
cleanup();
```

```output
baking
taking the pie out
closing the oven
```

## Classes

### Defining a class

A class is a block of assignments after the `class` keyword. Every member must
have a starting value. Calling the class constructs an object: arguments fill
the members in order, and members without an argument keep their starting
value. Arguments are positional.

```pie run+
Pie = class {
    filling: String = "apple";
    slices: Int = 8;

    describe = () => print("A {filling} pie with {slices} slices");
};

Pie().describe();
Pie("cherry").describe();
Pie("pecan", 6).describe();
```

```output
A apple pie with 8 slices
A cherry pie with 8 slices
A pecan pie with 6 slices
```

Classes are values: `Pie` above is a variable that holds a class, and it can be
used as a type.

### Members and self

Methods can read and change members directly. `self` is the object itself.

```pie run+
Counter = class {
    count = 0;

    bump = () => count = count + 1;
    me = () => self;
};

c = Counter();
c.bump();
c.bump();
print(c.count);
print(c.me().count);
```

```output
2
2
```

### Printing objects

Objects print their members. Members whose names start with `__` are hidden
unless you pass `show_hidden = true`. Give a class a `toString` method that
returns a string to control how it prints.

```pie run+
Secret = class {
    name = "Pie";
    __pin = 1234;
};
print(Secret());
print(Secret(), show_hidden = true);

Fraction = class {
    top = 1;
    bottom = 2;
    toString = () => "{top}/{bottom}";
};
print(Fraction(3, 4));
```

```output
Object {
    name = "Pie";
}
Object {
    name = "Pie";
    __pin = 1234;
}
3/4
```

### Cascades

`object..method()` calls a method and gives back the *object* instead of the
method's result. Chain them to build objects step by step.

```pie run+
Order = class {
    items = {};
    add = (item) => __builtin_push(items, item);
};

order = Order()..add("apple pie")..add("tea");
print(order.items);
```

```output
{apple pie, tea}
```

### Structural typing

An object fits a class type when it has all of that class's members with
matching types. The class it was built from doesn't matter.

```pie run+
Named = class { name = ""; };
Person = class { name = ""; age = 0; };

hello = (who: Named) => print("Hello, {who.name}!");
hello(Person("Ali", 30));
```

```output
Hello, Ali!
```

## Types

### Built-in types

| Type | Values |
| --- | --- |
| `Int` | Whole numbers of any size |
| `Double` | Floating point numbers |
| `Bool` | `true` and `false` |
| `String` | Text |
| `Any` | Anything at all |
| `Type` | Types themselves |
| `Syntax` | Unevaluated code (see [Syntax and eval](#syntax-and-eval)) |

### Compound types

| Type | Meaning |
| --- | --- |
| `{T}` | A list of `T` |
| `{K: V}` | A map from `K` to `V` |
| `(A, B): R` | A function from `A` and `B` to `R` |
| `...T` | A pack of `T` |

```pie run+
names: {String} = {"Ali", "Pie"};
ages: {String: Int} = {"Ali": 30};
twice: (Int): Int = (x: Int): Int => x * 2;
print(twice(21));
```

```output
42
```

### Types are values

Types can be stored in variables, passed to functions and printed. A type alias
is just a variable.

```pie run+
Number = Int;
x: Number = 42;
print(Number);
print(__builtin_type(x));
```

```output
Int
Int
```

Some types, like function types, don't look like expressions. Put a `:` in
front of them to write them where an expression is expected.

```pie run+
IntToBool = :(Int): Bool;
isBig: IntToBool = (n: Int): Bool => n > 100;
print(IntToBool);
```

```output
(Int): Bool
```

Since types are values, a parameter's type can depend on an earlier parameter:

```pie run+
same = (T: Type, a: T, b: T) => print("both are {T}");
same(Int, 1, 2);
same(String, "x", "y");
```

```output
both are Int
both are String
```

### Unions

A union accepts a value of any of its member types.

```pie run+
Number = union { Int; Double; };
x: Number = 5;
x = 2.5;
print(x);
```

```output
2.500000
```

```pie error
Number = union { Int; Double; };
x: Number = "five";
```

### Values as types

A value can be used as a type that only that value fits. Combined with unions,
that gives you enumerations.

```pie run+
Size = union { "small"; "medium"; "large"; };
order: Size = "medium";
order = "large";
print(order);
```

```output
large
```

```pie error
Size = union { "small"; "medium"; "large"; };
order: Size = "huge";
```

### Concepts

A function that returns a `Bool` can be used as a type. A value fits the type
when the function returns `true` for it.

```pie run+
Positive = (n: Int) => n > 0;
Small = (n: Int) => n < 10;

grow = (n: Positive): Small => n + 1;
print(grow(5));
```

```output
6
```

```pie error+
Positive = (n: Int) => n > 0;
Small = (n: Int) => n < 10;

grow = (n: Positive): Small => n + 1;
grow(9);
```

Parameter types act as preconditions and the return type as a postcondition,
so this is design by contract for free.

### Conversions

```pie run+
print(__builtin_to_int("42") + 1);
print(__builtin_to_double(3));
print(__builtin_to_string(12) + "!");
```

```output
43
3.000000
12!
```

## Unpacking

### Unpacking lists and objects

Put a pattern of names in braces on the left of `=` to pull a list or object
apart. This is called an *unpackment*.

```pie run+
{a, b, c} = {1, 2, 3};
print(a, b, c);

Person = class { name = ""; age = 0; };
{who, years} = Person("Ali", 30);
print("{who} is {years}");
```

```output
1 2 3
Ali is 30
```

Object members are matched by position, not by name.

### Collecting the rest

`...name` collects any number of elements into a pack. It can go anywhere in
the pattern. A bare `...` skips elements without naming them.

```pie run+
{first, ...rest} = {1, 2, 3, 4};
print(first);
print(rest);

{head, ..., tail} = {"a", "b", "c", "d"};
print(head, tail);
```

```output
1
2, 3, 4
a d
```

### Checking while unpacking

Each name in a pattern can have a type (`: T`) and a value (`= v`) that the
element must match. If it doesn't, the program stops with an error. The name
itself is optional.

```pie run+
{name: String, = 3} = {"Pie", 3};
print(name);
```

```output
Pie
```

```pie error+
{name: String, = 3} = {"Pie", 4};
```

### Nested patterns

Patterns can contain patterns.

```pie run+
{x, {y, z}} = {1, {2, 3}};
print(x + y + z);
```

```output
6
```

A `...` followed by a pattern unpacks *every* remaining element with that
pattern, collecting each name into a pack.

```pie run+
Person = class { name = ""; age = 0; };
people = {Person("Ali", 30), Person("Pie", 3)};

{...{names, ages}} = people;
print(names);
print(ages);
```

```output
Ali, Pie
30, 3
```

## Pattern matching

`match` compares a value against a list of patterns and runs the first one
that fits. Each case is `pattern => expression;`.

### Matching values and types

`= value` matches a value, `: Type` matches a type, and a plain name matches
anything (and names it).

```pie run+
describe = (x) => match x {
    = 0       => "zero";
    : String  => "some text";
    : Double  => "a decimal";
    n         => "the number {n}";
};

print(describe(0));
print(describe("hi"));
print(describe(2.5));
print(describe(7));
```

```output
zero
some text
a decimal
the number 7
```

If no case matches, the program stops with an error.

### Matching structure

Patterns from [Unpacking](#unpacking) work in `match` too, so you can match on
the shape of lists and objects. Put `: ClassName` after a pattern to require
an exact class.

```pie run+
Circle = class { r = 0; };
Rect = class { w = 0; h = 0; };

area = (shape) => match shape {
    {r}: Circle    => 3 * r * r;
    {w, h}: Rect   => w * h;
};

print(area(Circle(2)));
print(area(Rect(3, 4)));
```

```output
12
12
```

### Guards

Add `, condition` after a pattern to only match when the condition is `true`.

```pie run+
sign = (n) => match n {
    x, x < 0  => "negative";
    = 0       => "zero";
    _         => "positive";
};

print(sign(- 4));
print(sign(0));
print(sign(9));
```

```output
negative
zero
positive
```

### A bigger example

```pie run+
Leaf = class { value = 0; };
Node = class { left = 0; right = 0; };

sum = (tree) => match tree {
    {v}: Leaf            => v;
    {l, r}: Node         => sum(l) + sum(r);
};

tree = Node(Leaf(1), Node(Leaf(2), Leaf(3)));
print(sum(tree));
```

```output
6
```

## Packs and folds

### Packs

A pack is a group of values that travels together. You get one from a
variadic parameter or a `...` in a pattern. `__builtin_len` and `__builtin_get`
work on packs, and `loop` walks through them.

```pie run+
show = (...items) => {
    n = __builtin_len(items);
    print("{n} items:");
    loop item : items print("- {item}");
};
show("flour", "butter", "sugar");
```

```output
3 items:
- flour
- butter
- sugar
```

Spread a pack with a trailing `...` inside calls or lists:

```pie run+
both = (...xs) => {xs..., xs...};
print(both(1, 2));
```

```output
{1, 2, 1, 2}
```

### Expressions on packs

Accessing a member or calling a method on a pack does it for every element and
gives you a pack back.

```pie run+
Person = class { name = ""; age = 0; };
names = (...people) => people.name;
print(names(Person("Ali"), Person("Pie")));
```

```output
Ali, Pie
```

### Folds

A fold combines every element of a pack with an operator. Folds are always
written in parentheses.

| Fold | Expands to |
| --- | --- |
| `(pack + ...)` | `((a + b) + c)` |
| `(... + pack)` | `(a + (b + c))` |
| `(init + pack + ...)` | `(((init + a) + b) + c)` |
| `(... + pack + init)` | `(a + (b + (c + init)))` |

```pie run+
sum = (...xs) => (0 + xs + ...);
print(sum(1, 2, 3, 4));
print(sum());
```

```output
10
0
```

Folds without an initial value need at least one element.

### Separated folds

A separated fold puts a value between the elements as it goes. It's handy for
joining strings.

```pie run+
join = (...words) => (words + ... + ", ");
print(join("flour", "butter", "sugar"));
```

```output
flour, butter, sugar
```

| Fold | Expands to |
| --- | --- |
| `(pack + ... + sep)` | `((((a + sep) + b) + sep) + c)` |
| `(sep + ... + pack)` | the same, folded from the right |
| `(init + pack + ... + sep)` | like the first, starting from `init` |
| `(sep + ... + pack + init)` | like the second, ending with `init` |

The operator on each side can differ: `(xs + ... - 1)` adds the elements and
subtracts `1` between them.

## Syntax and eval

### Syntax literals

Code in backticks is not run. It becomes a `Syntax` value you can run later
with `__builtin_eval`. Names in it are looked up when it runs, not when it's
written.

```pie run+
later: Syntax = `price * 2`;
price = 5;
print(__builtin_eval(later));
price = 50;
print(__builtin_eval(later));
```

```output
10
100
```

### Syntax parameters

Wrap a parameter name in backticks and the argument arrives as `Syntax`
instead of being evaluated. This is how you write your own control flow.

```pie run+
twice = (`action`) => {
    __builtin_eval(action);
    __builtin_eval(action);
};
twice(print("pie!"));

unless = (cond, `body`) =>
    __builtin_eval(__builtin_conditional(cond, `0`, body));
unless(1 > 2, print("1 is not bigger than 2"));
```

```output
pie!
pie!
1 is not bigger than 2
```

Printing a `Syntax` value shows the code it holds:

```pie run+
show = (`code`) => print(code);
show(1 + 2 * 3);
```

```output
Syntax {
    (1 + (2 * 3))
}
```

## Namespaces and modules

### Namespaces

`space` groups names together. Unlike a class, a namespace can contain any
code, and it runs right away. Reach inside with `::`.

```pie run+
space bakery {
    owner = "Pie";
    open = (hour) => hour >= 7;

    space menu {
        special = "pecan";
    };
};

print(bakery::owner);
print(bakery::open(9));
print(bakery::menu::special);
```

```output
Pie
true
pecan
```

Declaring a namespace again adds to it, so one namespace can be spread across
several files.

```pie run+
space shop { a = 1; };
space shop { b = 2; };
print(shop::a + shop::b);
```

```output
3
```

### use

`use` brings one name into the current scope. It is a reference, so changes go
both ways. `use space` brings in every name, and `use name::` brings in only
the operators.

```pie run
space math {
    pi = 3.14159;
    tau = 6.28318;
    infix + = (a, b) => __builtin_add(a, b);
};

use math::pi;
__builtin_print(pi);

use math::;
__builtin_print(1 + 1);

use space math;
__builtin_print(tau);
```

```output
3.141590
2
6.283180
```

### Imports

`import path;` runs another file (without the `.pie`) and makes its top-level
namespaces available. Its plain global variables stay private to it.

```pie
.: shapes.pie
space shapes {
    square = (x) => __builtin_mul(x, x);
};
```

```pie
.: main.pie
import shapes;
__builtin_print(shapes::square(4));
```

The import expression evaluates to the last value in the imported file.

> The playground runs a single file, so `import` only works with Pie installed
> on your computer.

### The standard library

Pie comes with a small standard library in the `std` folder of the repository.
`import std;` gives you a `std` namespace with `print`, the arithmetic and
comparison operators, `as` for conversions (`"5" as Int`), the `: ? : else :`
conditional, `Iota` and `Enumerate` iterators, and more. Use `use std::;` to
bring its operators into scope.

## Built-in functions

These are always available. Many accept named arguments.

### Input and output

| Function | What it does |
| --- | --- |
| `__builtin_print(...values, sep = " ", end = "\n")` | Prints values, returns the last one |
| `__builtin_input_str()` | Reads a line as a `String` |
| `__builtin_input_int()` | Reads an `Int` |
| `__builtin_panic(...values)` | Stops the program with a message |

### Arithmetic

| Function | What it does |
| --- | --- |
| `__builtin_add(a, b)` | `a + b` |
| `__builtin_sub(a, b)` | `a - b` |
| `__builtin_mul(a, b)` | `a * b` |
| `__builtin_div(a, b)` | `a / b` (whole numbers stay whole) |
| `__builtin_mod(a, b)` | Remainder |
| `__builtin_pow(a, b)` | `a` to the power `b` |
| `__builtin_neg(a)` | `-a` |
| `__builtin_abs(a)` | Absolute value |
| `__builtin_rand_int(lo, hi)` | Random `Int` between `lo` and `hi` |

### Comparison and logic

| Function | What it does |
| --- | --- |
| `__builtin_eq(a, b)` | Equal (works on every value) |
| `__builtin_lt`, `__builtin_leq`, `__builtin_gt`, `__builtin_geq` | `<`, `<=`, `>`, `>=` |
| `__builtin_and(a, b)`, `__builtin_or(a, b)`, `__builtin_not(a)` | Logic |
| `__builtin_conditional(cond, then, else)` | Picks a branch, evaluating only that one |

### Collections and strings

| Function | What it does |
| --- | --- |
| `__builtin_len(x)` | Length of a string, list, map or pack |
| `__builtin_get(x, i)` | Element `i` (or key `i` of a map) |
| `__builtin_set(x, i, v)` | Sets an element or map key |
| `__builtin_push(list, v)` | Adds to the end |
| `__builtin_pop(list)` | Removes and returns the last element |
| `__builtin_pop_front(list)` | Removes and returns the first element |
| `__builtin_insert_at(list, i, v)` | Inserts before position `i` |
| `__builtin_remove_at(list, i)` | Removes position `i` |
| `__builtin_reverse(x)` | Reversed copy |
| `__builtin_into_pack(list)` | Turns a list into a pack |
| `__builtin_concat(...strings)` | Joins strings |
| `__builtin_str_slice(s, start, end, step)` | Part of a string |
| `__builtin_str_split(s, sep)` | Splits into a list |

### Types and conversion

| Function | What it does |
| --- | --- |
| `__builtin_type(x)` | Type of a value |
| `__builtin_decltype(x)` | Declared type of a variable |
| `__builtin_to_int`, `__builtin_to_double`, `__builtin_to_string` | Conversions |
| `__builtin_object_has(obj, "name")` | Whether an object has a member |

### Evaluation

| Function | What it does |
| --- | --- |
| `__builtin_eval(syntax)` | Runs a `Syntax` value |
| `__builtin_defer(expr)` | Runs `expr` when the current scope ends |
| `__builtin_reset(x)` | Undoes an assign-to-anything for `x` |

The interpreter also has built-ins for files (`__builtin_open_file` and
friends) and for calling C libraries (`__builtin_dlopen`, `__builtin_ffi_call`).
The `std/file.pie` and `std/ffi.pie` modules wrap them. Neither works in the
playground.

## Reference

### Keywords

| Group | Keywords |
| --- | --- |
| Operators | `prefix` `infix` `suffix` `exfix` `mixfix` |
| Types | `class` `union` |
| Control | `loop` `break` `continue` `match` |
| Modules | `space` `use` `import` |

`true`, `false`, `self` and the built-in type names are values, not keywords,
so they can be reassigned. Everything else, including every operator, is a
name you define.

### Reserved punctuation

`(` `)` `{` `}` `,` `;` `:` `::` `=` `:=` `=>` `.` `..` `...` and backticks.

### Installing

Prebuilt binaries for Linux and macOS are on the
[releases page](https://github.com/AliAlmutawaJr/Pie/releases). To build from
source you need `git`, `cmake`, `make` and a C++23 compiler:

```sh
git clone https://github.com/AliAlmutawaJr/Pie
cd Pie
mkdir build && cd build
cmake ..
make
```
