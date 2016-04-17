"use strict";
/*
-------------------------------------------------------------------------------------------
NOTES AND EDGE CASES:
-------------------------------------------------------------------------------------------
- A "numeric" is any sequence of 1+ digits OR any defined numeric constant.
	- Constants are replaced by their actual value on interpretation
	- Values currently accepted:
		- pi
		- phi (the golden ratio)
		- e
	- Values not accepted that might be in the future: 
		- (+/-)infinity, i (only used in limits/complex plane respectively)
		- epsilon
		
- Functions
	- Some pertinent functions that are included:
		- The trigonometric functions, namely sin, cos, tan, sec, csc, cot, 
			- and their hyperbolic and inverse counterparts
		- The logarithmic function, as well as the natural log (ln)
		- The absolute value function, |a + b|
		- sqrt(val) as a short-hand for (val)^(1/2)
	- Some functions that are not included:
		- gradient
		- gamma, zeta

- Handling Functions
	- Functions are very tricky. Conceptually, we wrap them in parentheses to force evaluation
	- However, simply starting a new stack frame is not enough
	- Unlike parentheses, we do not have an explicit close
	- Instead, we have to track how many arguments have been received
		- We increment a counter every time an expression is pushed;
		- When that counter equals the number of arguments to the function,
			- We evaluate the expression
	- This works great for every type of expression: 
		- numerics are normal, parentheses will evaluate out fine
		- functions trigger the same process on another frame
	- If an operator is pushed in a FUNCTION frame
		- throw an error. This is not the case for a nested () frame.
		- A FUNCTION frame is any frame that has a function at its lowest point
			- We just check whenever adding an op that the lowest thing isn't a function
		- The notable exception is TRIG EXPONENTS; TBD later
		
- Absolute value (abs) is a function, but syntactically works like parentheses
	- The tricky distinction with abs is that there is no definitive closing criteria
	- The method used to determine a close is as follows:
		- The depth must be greater than 0
		- The last operation on the previous depth must also have been an abs
		- The number of required expressions on the current depth must be satisfied
			- This is the tricky one
			- Here we assume that if another abs is triggered and there still are remaining required expressions
			- the abs we are evaluating wraps one of those of expressions
	- The number of required expressions is the total of required arguments for each operation on the operation stack
		- It is considered satisfied is the number of expressions on the expression stack is >= to it
		- The number is incremented every time we add an operation to the stack:
			- If the number of arguments is > the current requisite, 
				- the requisite becomes the number of args
			- Otherwise, we just increment by 1
			- This could change if later on expressions have multiple outputs
	
- Trig Exponents
	- Exponents after a trig function have a special interpretation, where they're treated as:
		- (^ (trig(val)) exp)
		- under ordinary interpretation this would be (^ (trig(exp)) val), due to read order
		- Fixing this is not trivial.
			- Pushing the exponent and the next expression onto the previous frame
				- Results in the expression (^ exp (trig(val))), which is NOT right
			- What's the solution? Inversion count!
				- now, when a VALID operator is read on a function stack,
					- we set the PUSH function for this and the previous frame
				- What does the PUSH function do? That depends:
					- PUSH = currPush; add the expr as normal
					- PUSH = prevPush; add the expr TO THE PREVIOUS FRAME
					- PUSH = swapPush; push the expr, then swap with the current top expr
	- Negative exponents are not allowed, you have to do that manually (b/c arc functions)
	
- Log functions
	- log is written as log_[base], where [base] is some numeric
		- this means we can have log_pi5, but log_15 will be invalid
		- parentheses are recommended
		- you can leave out a base, in which case it will default to 10
		
- Implicit operations
	- There are two types of implicit operations:
		- Unary +/-
			- These occur when an operation is not preceded by an expression
			- but only for + or - (really only -)
			- The implementation is just if there is a +/- with too few expressions already
				- Add a 0
				- Theoretically, an implicit * or / would be a 1, 
					- but that's undefined anyway, so we ignore it
		- Implicit *
			- This can happen on the left or right of any expression
				- If an expression is NOT followed by an operator
					- there is an implicit *
					- EXCEPT at the end of the larger expression
				- Does the end of expression thing make our life more difficult?
					- If we reach the end of the overall string,
						- the push function will never be called
					- If we reach the end of a parentheses or abs scope,
						- the frame gets popped, nothing is added
					- If we reach the end of a function scope,
						- same applies, the function gets popped
					- The answer is no, it's naturally handled by the process
		- When an implicit operation is detected, 
			- the applicable operation/numeric is added automatically
-------------------------------------------------------------------------------------------
*/

var errString = '';//used for error handling

var opOrder = {
	NONE : undefined,
	FN   :  0.1,
	TRIG :  0.5,
	EXP  :  1,
	PROD :  2,
	SUM  :  3
};
Object.seal(opOrder);
Function.prototype.oo = opOrder.NONE;

var type = { NONE : undefined, OP : 1, EXPR : 2 };
Object.seal(type);

var phi = (1 + Math.sqrt(5)) / 2;// 1.618033988749895
var pi = Math.PI;
var e = Math.E;

var number = '\\d+(\\.\\d+)?';
var constant_list = ['e','pi','phi'];
var constant_vals = [ e, pi, phi ];
var constant = constant_list.join('|');
constant_list.forEach(function(element,index) { constant_list[index] = [ new RegExp(element), constant_vals[index] ]; });
var number_regex_str = '(' + number + '|' + constant + ')';

var log_regex_str = '(log_?|ln)';//if no base is included, it's assumed to be 10
var trig_regex_str = '((a|arc)?((cos)|(sin)|(tan)|(sec)|(csc)|(cot))h?)';
var function_regex_str = '(^' + trig_regex_str + '|^' + log_regex_str + '|^(sqrt))';

var add_regex = '(\\+|-)';
var mul_regex = '(\\*|\\/)';
var operator_regex_str = '(\\^|' + mul_regex + '|' + add_regex + ')';

var finder_regex = new RegExp(
'(^' + number_regex_str + '|^\\(|^\\)|\\||^' + function_regex_str + '|^' + operator_regex_str + '|^t)'
);

var number_regex   = new RegExp(number_regex_str);
var trig_regex     = new RegExp(trig_regex_str);
var log_regex      = new RegExp(log_regex_str);
var function_regex = new RegExp(function_regex_str);
var operator_regex = new RegExp(operator_regex_str);

function add(a,b) { return a + b; } add.oo = opOrder.SUM;
function sub(a,b) { return a - b; } sub.oo = opOrder.SUM;
function mul(a,b) { return a * b; } mul.oo = opOrder.PROD;
function div(a,b) { return a / b; } div.oo = opOrder.PROD;

function exp(a,b) { return Math.pow(a,b); } exp.oo  = opOrder.EXP;
function sqrt(a)  { return Math.sqrt(a);  } sqrt.oo = opOrder.FN;

function sin(a)  { return Math.sin(a);  }     function asin(a)  { return Math.asin(a);    }
function sinh(a) { return Math.sinh(a); }     function asinh(a) { return Math.asinh(a);   }
function cos(a)  { return Math.cos(a);  }     function acos(a)  { return Math.acos(a);    }
function cosh(a) { return Math.cosh(a); }     function acosh(a) { return Math.acosh(a);   }
function tan(a)  { return Math.tan(a);  }     function atan(a)  { return Math.atan2(a,1); }
function tanh(a) { return Math.tanh(a); }     function atanh(a) { return Math.atanh(a);   }
function csc(a)  { return 1 / sin(a);  } function acsc(a)  { return asin(1/a);  }
function csch(a) { return 1 / sinh(a); } function acsch(a) { return asinh(1/a); }
function sec(a)  { return 1 / cos(a);  } function asec(a)  { return acos(1/a);  }
function sech(a) { return 1 / cosh(a); } function asech(a) { return acosh(1/a); }
function cot(a)  { return 1 / tan(a);  } function acot(a)  { return atan(1/a); }
function coth(a) { return 1 / tanh(a); } function acoth(a) { return atanh(1/a); }
var trig_fns = { 
	sin:sin,asin:asin,arcsin:asin,sinh:sinh,asinh:asinh,arcsinh:asinh,
	cos:cos,acos:acos,arccos:acos,cosh:cosh,acosh:acosh,arccosh:acosh,
	tan:tan,atan:atan,arctan:atan,tanh:tanh,atanh:atanh,arctanh:atanh,
	csc:csc,acsc:acsc,arccsc:acsc,csch:csch,acsch:acsch,arccsch:acsch,
	sec:sec,asec:asec,arcsec:asec,sech:sech,asech:asech,arcsech:asech,
	cot:cot,acot:acot,arccot:acot,coth:coth,acoth:acoth,arccoth:acoth
 };
 for(var fn in trig_fns) { trig_fns[fn].oo = opOrder.TRIG; }

function log(base,val) { return Math.log(val) / Math.log(base); } log.oo = opOrder.FN;
function ln(a) { return Math.log(a); } ln.oo = opOrder.FN;

function abs(a) { return Math.abs(a); } abs.oo = opOrder.FN;

var Expression = function(op,a,b) {
	this.operation = op;
	this.left = a;
	this.right = b;
};
Expression.prototype.name = 'Expression';
Expression.prototype.toString = function() { 
	return '(' + this.operation.name + ' '
	+ this.left.toString()
	+ ((this.operation.length > 1) ? ', ' + this.right.toString() : '') + ')';
}
Expression.prototype.evaluate = function(t) {
	return this.operation(this.left.evaluate(t), this.right.evaluate(t));
}

var T = function() { Expression.call(this); }
T.prototype = Object.create(Expression.prototype);
T.prototype.toString = function() { return this.name; }
T.prototype.name = 'T';
T.prototype.evaluate = function(t) { return t; }

var Constant = function(val) { Expression.call(this); this.value = val; }
Constant.prototype = Object.create(Expression.prototype);
Constant.prototype.toString = function() { return this.value; }
Constant.prototype.name = 'Constant';
Constant.prototype.evaluate = function() { return this.value; }

var StackFrame = function(prev) {
	this.expressionList = [];
	this.operationList = [];
	this.currAdd = type.NONE;
	this.lastAdd = type.NONE;// tracks whether the last thing added was an expr or op
	this.lastOp = opOrder.NONE;// tracks order of operations
	this.argsAdded = 0;// tracks the number of expressions pushed
	this.numExprReq = 0;// tracks the 
	this.push = this.pushStd;
	this.prev = prev;
	this.wait = undefined;//when entering (paren) or |abs|, this is set to the opening character while on the other stack
};

StackFrame.prototype.lastOperation = function(disp) {
	return this.operationList[this.operationList.length - (disp || 1)];
}
StackFrame.prototype.hasEnoughExprs = function() {
	return this.numExprReq <= this.expressionList.length
}
StackFrame.prototype.isFunctionStack = function() {
	return this.lastOp < opOrder.EXP;
}
StackFrame.prototype.orderBroken = function() {
	var end = this.operationList.length - 1;
	//if(end > 0) console.log(this.operationList[end - 1].name + ', ' + this.operationList[end].name);
	return end > 0 && this.operationList[end - 1].oo <= this.operationList[end].oo;
}
StackFrame.prototype.functionReady = function() {
	return this.isFunctionStack() && this.argsAdded >= this.operationList[0].length;
}

StackFrame.prototype.pushExpression = function(expr) { this.push(expr); };
StackFrame.prototype.pushStd  = function(expr) { 
	this.expressionList.push(expr); 
	++this.argsAdded;
	this.lastAdd = this.currAdd;
	this.currAdd = type.EXPR;
};
StackFrame.prototype.pushPrev = function(expr) { 
	this.prev.pushStd(expr);
	var lastAdd = this.prev.lastAdd;
	this.prev.lastAdd = this.prev.currAdd;
	this.prev.currAdd = lastAdd;
	this.push = this.pushStd; 
};
StackFrame.prototype.pushSwap = function(expr) { 
	var end = this.expressionList.length - 1;
	this.pushStd(this.expressionList[end]);
	this.expressionList[end] = expr;
	this.push = this.pushStd;
};

StackFrame.prototype.pushOperation = function(op) {
	this.operationList.push(op);
	(op.length > this.numExprReq && (this.numExprReq = op.length)) 
	|| ++this.numExprReq;
	this.lastAdd = this.currAdd;
	this.currAdd = type.OP;
};

function getSymbol(op) {
	var str = '???';
	if     (op == exp) str = '^';
	else if(op == mul) str = '*';
	else if(op == div) str = '/';
	else if(op == add) str = '+';
	else if(op == sub) str = '-';
	else if(op && op.oo < opOrder.EXP) str = op.name;
	return str;
}

function genExpression(op,left,right) {
	//console.log(((op) ? op.name : op) + ', ' 
	//+ (left ? left.toString() : left) + ', ' + (right ? right.toString() : right));
	
	if(!left)  left  = new Constant(0);
	if(!right) right = new Constant(0);
	if(left.value != undefined && right.value != undefined)
		return new Constant(op(left.value,right.value));
	if(op.length == 1 && left.value == 0 && !right.value) {
		left = right;
		right = new Constant(0);
	}
	return new Expression(op,left,right);
}

StackFrame.prototype.getExpression = function() {
	//console.log('Getting expression');
	var opEnd = this.operationList.length - 1;
	var exprEnd = this.expressionList.length - 1;
	if(opEnd < 0) {
		if(exprEnd < 0) return null;
		else return this.expressionList.pop();//this is a valid constant or t
	}
	do {
		var op = this.operationList.pop(), left = undefined, right = undefined;
		--opEnd;
		for(var i = 0, args = op.length; i < args; ++i) {
			if(exprEnd < 0) {
				errString = "Not enough arguments for " + getSymbol(op);
				return undefined;
			}
			var expr = this.expressionList.pop();
			if(right) left  = expr;
			else      right = expr;
			--exprEnd;
		}
		this.expressionList.push(genExpression(op,left,right));
		exprEnd++;
	} while(opEnd >= 0);
	return this.expressionList.pop();
}

function printSubStack(subStack,exprNum) {
	var str = '[';
	for(var item in subStack) {
		var curr = subStack[item];
		str += (curr.hasOwnProperty('left') ? curr.toString() : curr.name) + ', ';
	}
	if (subStack.wait) str += subStack.wait + ' ';
	str += ']';
	str += (exprNum != undefined ? '(' + exprNum + ')' : '') + ', ';
	return str;
}

function printStack(stack,depth) {
	var exprStr = '', opStr = '';
	for(var i = 0; i < depth + 1;i++) {
		exprStr += printSubStack(stack[i].expressionList);
		opStr   += printSubStack(stack[i].operationList,stack[i].numExprReq);
	}
	console.log(exprStr);
	console.log(opStr);
}

function parseEquation(eqString) {
	errString = 'Something went wrong :(';
	//remove whitespace
	eqString = eqString.replace(/\s+/g,'');
	if(!eqString.length) {
		errString = 'Empty equation';
		return undefined;
	}
	var stack = [ new StackFrame() ];
	var depth = 0;
	while(eqString.length) {
		//first expression present
		//it matches each time because some results are dependent on others being processed
		var expr = eqString.match(finder_regex);
		if(!expr) {
			errString = 'There was an invalid term';
			return undefined;
		}
		expr = expr[0];
		eqString = eqString.replace(finder_regex,'');
		//console.log('=> ' + expr + ', ' + eqString);
		var currOp = opOrder.NONE, num_present = false;
		if(expr[0] == '(' || expr[0] == '|') {
			//if we're processing an abs, to close:
			//one of the previous levels' last op must also be an abs
			//and the number of required expressions in the current level must be satisfied
			//otherwise, open a new one
			if(expr[0] == '|' && depth && stack[depth].expressionList.length &&
			stack[depth].hasEnoughExprs() && stack.some(function(el) { return el.wait == '|'; })) {
				var absExpr = stack.pop().getExpression();
				depth--;
				stack[depth].wait = undefined;
				if(absExpr == undefined) return undefined;
				if(absExpr != null) stack[depth].pushExpression(genExpression(abs,absExpr,undefined));
			}
			else {
				stack[depth].wait = expr[0];
				stack.push(new StackFrame(stack[depth]));
				++depth;
			}
		}
		else if(expr[0] == ')') {
			if(!depth || !stack.some(function(el) { return el.wait == '('; })) {
				errString = 'Closing ) found before (';
				return undefined;
			}
			var parenExpr = stack.pop().getExpression();
			depth--;
			stack[depth].wait = undefined;
			if(parenExpr == undefined) return undefined;
			if(parenExpr != null) stack[depth].pushExpression(parenExpr);
		}
		if(function_regex.test(expr)) {
			stack.push(new StackFrame(stack[depth]));
			depth++;
			currOp = opOrder.FN;
			if(trig_regex.test(expr)) {
				stack[depth].pushOperation(trig_fns[expr]);
				currOp = opOrder.TRIG;
			}
			else if(log_regex.test(expr)) {
				if(expr[1] == 'n') {
					stack[depth].pushOperation(ln);
				}
				else {
					stack[depth].pushOperation(log);
					if(expr.length < 4)//there's no base specified
						stack[depth].pushExpression(new Constant(10));
				}
			}
			else if(/(sqrt)/.test(expr)) {
				stack[depth].pushOperation(sqrt);
			}
		}
		else if(operator_regex.test(expr)) {
			var op = undefined;
			if(expr[0] == '^') {
				if( stack[depth].lastOp == opOrder.TRIG ) {
					//special case for trig exponents
					stack[depth-1].pushOperation(exp);
					stack[depth-1].push = stack[depth - 1].pushSwap;
					stack[depth].push = stack[depth].pushPrev;
				}
				else { op = exp; }
			}
			else if(expr[0] == '*') {
				op = mul;
			}
			else if(expr[0] == '/') {
				op = div;
			}
			else if(expr[0] == '+') {
				op = add;
			}
			else if(expr[0] == '-') {
				op = sub;
			}
			if(op) { 
				currOp = op.oo;
				stack[depth].pushOperation(op); 
			}
		}
		else if((num_present = number_regex.test(expr)) || /t/.test(expr)) {
			var val;
			if (/\d+(\.\d+)?/.test(expr)) { val = new Constant(Number.parseFloat(expr)); }
			else if(num_present) {
				constant_list.some(function(element,index) {
					return element[0].test(expr) && (val = new Constant(element[1]));
				});
			}
			else { val = new T(); }
			stack[depth].pushExpression(val);
		}
		
		//console.log(lastOp[depth] + ', ' + currOp);
		//console.log(stack[depth].lastAdd + ', ' + stack[depth].currAdd);
		if(((stack[depth].currAdd == type.OP && !stack[depth].expressionList.length) ||
		    (stack[depth].lastAdd == type.OP && stack[depth].currAdd != type.EXPR)) 
				&& stack[depth].lastOperation() == sub) {
			stack[depth].pushExpression(new Constant(0));
			stack[depth].lastAdd = type.EXPR;
			stack[depth].currAdd = type.OP;
		}
		if( stack[depth].orderBroken() ) {
			//we must evaluate an expression since we broke order of operations
			//console.log('Broke order');
			var op = stack[depth].operationList.pop();
			stack[depth].expressionList = [ stack[depth].getExpression() ];
			stack[depth].operationList  = [ op ];
			stack[depth].numExprReq = op.length;
		}
		else if ( stack[depth].functionReady() ) {
			//console.log('Completed function');
			--depth;
			stack[depth].pushExpression(stack.pop().getExpression());
		}
		//this runs into issues if chained more than 3 times
		if(stack[depth].lastAdd == type.EXPR && stack[depth].currAdd != type.OP) {
			stack[depth].pushOperation(mul);
			stack[depth].lastAdd = type.OP;
			stack[depth].currAdd = type.EXPR;
		}
		currOp && (stack[depth].lastOp = currOp);
		//console.log("Depth: " + depth);
		//console.log(stack[depth].lastAdd + ', ' + stack[depth].currAdd);
		//printStack(stack,depth);
	}
	if(depth > 0) {
		if(stack[depth].isFunctionStack())
			errString = 'Not enough arguments for ' + 
			getSymbol(stack[depth].lastOperation());
		else
			errString = 'Open ' + stack[depth - 1].wait + ' found with no close';
		return undefined;
	}
	else if(!stack[depth].hasEnoughExprs()) {
		errString = 'Not enough arguments for ' + 
		getSymbol(stack[depth].lastOperation());
		return undefined;
	}
	var final_expr = stack[depth].getExpression();
	console.log(final_expr.toString());
	return final_expr;
}