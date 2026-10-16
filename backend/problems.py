"""Coding problems for the technical interview. Tests are (args, expected) pairs."""

PROBLEMS = {
    "two-sum": {
        "id": "two-sum",
        "kind": "coding",
        "title": "Two Sum",
        "difficulty": "Easy",
        "tags": ["Array", "Hash Map"],
        "hints": [
            "A brute-force double loop works in O(n^2). Can you avoid re-scanning the array?",
            "For each number x, you need target - x. What structure gives O(1) lookups of numbers you've seen?",
        ],
        "approach": "One pass with a hash map from value to index. For each nums[i], if target - nums[i] is already in the map, return [map[target - nums[i]], i]; otherwise store nums[i] -> i.",
        "complexity": "O(n) time, O(n) space",
        "function": "two_sum",
        "prompt": (
            "Given a list of integers `nums` and an integer `target`, return the indices of the two numbers "
            "that add up to `target`. Exactly one solution exists, and you may not use the same element twice. "
            "Return the indices in increasing order."
        ),
        "examples": [
            "two_sum([2, 7, 11, 15], 9) -> [0, 1]",
            "two_sum([3, 2, 4], 6) -> [1, 2]",
        ],
        "starter": "def two_sum(nums: list[int], target: int) -> list[int]:\n    # Your solution here\n    pass\n",
        "tests": [
            ([[2, 7, 11, 15], 9], [0, 1]),
            ([[3, 2, 4], 6], [1, 2]),
            ([[3, 3], 6], [0, 1]),
            ([[-1, -2, -3, -4, -5], -8], [2, 4]),
            ([[0, 4, 3, 0], 0], [0, 3]),
        ],
    },
    "valid-parentheses": {
        "id": "valid-parentheses",
        "kind": "coding",
        "title": "Valid Parentheses",
        "difficulty": "Easy",
        "tags": ["Stack", "String"],
        "hints": [
            "The most recently opened bracket must be the first one closed.",
            "Push opening brackets on a stack; on a closing bracket, check the top matches.",
        ],
        "approach": "Use a stack and a map from closing to opening bracket. Push openers; for a closer, pop and compare to the expected opener (fail if empty or mismatched). Valid iff the stack is empty at the end.",
        "complexity": "O(n) time, O(n) space",
        "function": "is_valid",
        "prompt": (
            "Given a string `s` containing only the characters '()[]{}', determine whether the input string is "
            "valid. Open brackets must be closed by the same type of bracket, and in the correct order."
        ),
        "examples": [
            'is_valid("()[]{}") -> True',
            'is_valid("(]") -> False',
        ],
        "starter": "def is_valid(s: str) -> bool:\n    # Your solution here\n    pass\n",
        "tests": [
            (["()"], True),
            (["()[]{}"], True),
            (["(]"], False),
            (["([)]"], False),
            (["{[]}"], True),
            ([""], True),
            (["(("], False),
        ],
    },
    "merge-intervals": {
        "id": "merge-intervals",
        "kind": "coding",
        "title": "Merge Intervals",
        "difficulty": "Medium",
        "tags": ["Array", "Sorting"],
        "hints": [
            "Overlaps are easy to detect if intervals are processed in order of start time.",
            "After sorting, compare each interval's start with the end of the last merged interval.",
        ],
        "approach": "Sort by start. Keep a result list; for each interval, if it starts after the last merged end, append it, else extend the last merged end to max(end, current end).",
        "complexity": "O(n log n) time for the sort, O(n) space for the output",
        "function": "merge",
        "prompt": (
            "Given a list of intervals where intervals[i] = [start, end], merge all overlapping intervals and "
            "return a list of the non-overlapping intervals that cover all the intervals in the input, "
            "sorted by start."
        ),
        "examples": [
            "merge([[1,3],[2,6],[8,10],[15,18]]) -> [[1,6],[8,10],[15,18]]",
            "merge([[1,4],[4,5]]) -> [[1,5]]",
        ],
        "starter": "def merge(intervals: list[list[int]]) -> list[list[int]]:\n    # Your solution here\n    pass\n",
        "tests": [
            ([[[1, 3], [2, 6], [8, 10], [15, 18]]], [[1, 6], [8, 10], [15, 18]]),
            ([[[1, 4], [4, 5]]], [[1, 5]]),
            ([[[1, 4], [0, 4]]], [[0, 4]]),
            ([[[1, 4], [2, 3]]], [[1, 4]]),
            ([[[5, 7]]], [[5, 7]]),
        ],
    },
}


EMPLOYEES_SCHEMA = """
CREATE TABLE departments (id INTEGER PRIMARY KEY, name TEXT);
CREATE TABLE employees (id INTEGER PRIMARY KEY, name TEXT, salary INTEGER, department_id INTEGER);
INSERT INTO departments VALUES (1, 'Engineering'), (2, 'Sales'), (3, 'Design');
INSERT INTO employees VALUES
  (1, 'Ava', 185000, 1), (2, 'Ben', 172000, 1), (3, 'Chloe', 185000, 1),
  (4, 'Dev', 98000, 2), (5, 'Ella', 120000, 2), (6, 'Finn', 87000, 2),
  (7, 'Gia', 134000, 3), (8, 'Hugo', 101000, 3);
"""

SHOP_SCHEMA = """
CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT, signup_date TEXT);
CREATE TABLE orders (id INTEGER PRIMARY KEY, customer_id INTEGER, amount REAL, order_date TEXT);
INSERT INTO customers VALUES
  (1, 'Maya', '2026-01-04'), (2, 'Noah', '2026-02-11'), (3, 'Omar', '2026-02-20'),
  (4, 'Priya', '2026-03-02'), (5, 'Quinn', '2026-03-15');
INSERT INTO orders VALUES
  (1, 1, 42.50, '2026-03-01'), (2, 1, 18.00, '2026-03-09'), (3, 3, 99.99, '2026-03-12'),
  (4, 4, 15.25, '2026-04-01'), (5, 3, 60.00, '2026-04-03'), (6, 1, 33.10, '2026-04-07');
"""

SQL_PROBLEMS = {
    "second-highest-salary": {
        "id": "second-highest-salary",
        "kind": "sql",
        "title": "Second Highest Salary",
        "difficulty": "Medium",
        "tags": ["Subquery", "DISTINCT"],
        "prompt": (
            "Table `employees(id, name, salary, department_id)`. Write a query that returns the second highest "
            "DISTINCT salary as a single column named `second_highest_salary`."
        ),
        "examples": ["Salaries 185000, 185000, 172000, ... -> 172000"],
        "schema": EMPLOYEES_SCHEMA,
        "solution": "SELECT MAX(salary) AS second_highest_salary FROM employees WHERE salary < (SELECT MAX(salary) FROM employees)",
        "starter": "-- Return the second highest distinct salary\nSELECT\n  \nFROM employees;\n",
        "hints": [
            "Duplicates of the top salary shouldn't count as 'second'.",
            "Find the max salary that is strictly less than the overall max, or use DISTINCT + ORDER BY + LIMIT/OFFSET.",
        ],
        "approach": "SELECT MAX(salary) FROM employees WHERE salary < (SELECT MAX(salary) FROM employees). Alternatively SELECT DISTINCT salary ORDER BY salary DESC LIMIT 1 OFFSET 1.",
        "complexity": "One or two scans of employees",
    },
    "department-top-earners": {
        "id": "department-top-earners",
        "kind": "sql",
        "title": "Department Top Earners",
        "difficulty": "Medium",
        "tags": ["JOIN", "Window Functions"],
        "prompt": (
            "Tables `departments(id, name)` and `employees(id, name, salary, department_id)`. Return every "
            "employee who has the highest salary in their department, as columns (department, employee, salary). "
            "Include ties. Row order doesn't matter."
        ),
        "examples": ["Engineering has a tie at 185000 -> both Ava and Chloe are returned"],
        "schema": EMPLOYEES_SCHEMA,
        "solution": (
            "SELECT d.name, e.name, e.salary FROM employees e JOIN departments d ON d.id = e.department_id "
            "WHERE e.salary = (SELECT MAX(salary) FROM employees WHERE department_id = e.department_id)"
        ),
        "starter": "SELECT d.name AS department, e.name AS employee, e.salary\nFROM employees e\nJOIN departments d ON d.id = e.department_id\n-- filter to top earners\n;\n",
        "hints": [
            "You need each department's max salary — a correlated subquery or a GROUP BY you join back to.",
            "Window functions work too: RANK() OVER (PARTITION BY department_id ORDER BY salary DESC) = 1.",
        ],
        "approach": "Join employees to departments and keep rows where salary equals the department max (correlated subquery), or rank within each department with RANK() and keep rank 1 so ties survive.",
        "complexity": "O(n log n) with a window function; correlated subquery is O(n^2) without an index",
    },
    "customers-without-orders": {
        "id": "customers-without-orders",
        "kind": "sql",
        "title": "Customers Without Orders",
        "difficulty": "Easy",
        "tags": ["LEFT JOIN", "Anti-join"],
        "prompt": (
            "Tables `customers(id, name, signup_date)` and `orders(id, customer_id, amount, order_date)`. "
            "Return the `name` of every customer who has never placed an order. Row order doesn't matter."
        ),
        "examples": ["Noah and Quinn have no orders -> Noah, Quinn"],
        "schema": SHOP_SCHEMA,
        "solution": "SELECT name FROM customers WHERE id NOT IN (SELECT customer_id FROM orders)",
        "starter": "SELECT name\nFROM customers\n-- customers with no orders\n;\n",
        "hints": [
            "This is an anti-join: rows in A with no match in B.",
            "LEFT JOIN orders and keep rows where the order id IS NULL, or use NOT EXISTS.",
        ],
        "approach": "SELECT c.name FROM customers c LEFT JOIN orders o ON o.customer_id = c.id WHERE o.id IS NULL (or NOT EXISTS / NOT IN).",
        "complexity": "Single join; O(n + m) with a hash join",
    },
}

PROBLEMS = PROBLEMS | SQL_PROBLEMS

HIDDEN = {"tests", "solution", "schema"}


def public_problem(p: dict) -> dict:
    """Problem without hidden tests/solutions, for the frontend."""
    out = {k: v for k, v in p.items() if k not in HIDDEN}
    out["test_count"] = len(p.get("tests", [])) or 1
    if p["kind"] == "sql":
        out["tables"] = [line.strip() for line in p["schema"].splitlines() if line.strip().startswith("CREATE TABLE")]
    return out
