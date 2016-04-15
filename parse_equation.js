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
		
- Absolute value is interpreted like parentheses...
	- ...With an additional abs expression wrapped around the result
	- The tricky distinction with abs is that there is no definitive closing criteria
	- The method used to determine a close is as follows:
		- The depth must be greater than 0
		- The last operation on the previous depth must also have been an abs
		- This is the tricky one: the number of required expressions on the current depth must be satisfied
			- Here we assume that if another abs is triggered and there still are remaining required expressions
			- the abs we are evaluating is one of those of expressions
	- The number of required expressions is the total of required arguments for each operation on the operation stack
		- It is considered satisfied is the number of expressions on the expression stack is >= to it
		- ACTUALLY, the number is affected by cascade. Any function will output one value, so really...
		- all we need are the greatest number of arguments in a function + the number of functions - 1?
		- fix this
	
- Trig Exponents
	- Exponents after a trig have a special interpretation, where it's treated as:
		- (trig(val))^exp
		- under ordinary interpretation this would be (trig(exp))^val, due to read order
		- therefore, trig exponents actually have to let the trig function behind them go first,
		- as if there were parentheses
	- Negative exponents are not allowed, you have to do that manually (b/c arc functions)
	
- Log functions
	- log is written as log_[base], where [base] is some numeric
		- this means we can have log_pi5, but log_15 will be invalid
		- parentheses are recommended
		- you can leave out a base, in which case it will default to 10
		
- Implicit operations
	- There are two types of implicit operations:
		- Unary +/-
			- These occur when there are too many operations for expressions,
			- after adding a + or -
			- The implementation is just if there is a +/- with too few expressions already
				- Add a 0
				- Theoretically, an implicit * or / would be a 1, but that's undefined anyway
		- Implicit *
			- This can happen on the left or right of any expression
				- If a numeric is immediately followed by a paren, a function, or t, 
					- there is an implicit *
				- If a paren, a [closed] function, or t is immediately followed by a numeric
					- there is an implicit *
				- In other words, if a number is adjacent to anything except an operation, 
					- there's an implicit multiply
				- When adding a numeric or t, if there are more expressions than operations,
					- there must be an implicit *
				- Technically, any non-op in a position like this gets an implicit multiply...
					- we'll fix that later
		- When an implicit operation is detected, 
			- the applicable operation/numeric is added automatically
-------------------------------------------------------------------------------------------
*/

var errString = '';//used for error handling

var orderOfOperations = {
	NONE : -1,
	FN : 0,
	EXP : 1,
	MUL : 2,
	ADD : 3
};
Object.seal(orderOfOperations);
Function.prototype.oo = orderOfOperations.NONE;

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

var add_regex = '(\\+|-)';
var mul_regex = '(\\*|\\/)';
var operator_regex_str = '(\\^|' + mul_regex + '|' + add_regex + ')';

var finder_regex = new RegExp(
'(^' + number_regex_str + '|^\\(|^\\)|^' + trig_regex_str + '|^' + log_regex_str + '|^(sqrt)' + '|^' + operator_regex_str + '|^t)'
);

var number_regex   = new RegExp(number_regex_str);
var trig_regex     = new RegExp(trig_regex_str);
var log_regex      = new RegExp(log_regex_str);
var operator_regex = new RegExp(operator_regex_str);

function add(a,b) { return a + b; } add.oo = orderOfOperations.ADD;
function sub(a,b) { return a - b; } sub.oo = orderOfOperations.ADD;
function mul(a,b) { return a * b; } mul.oo = orderOfOperations.MUL;
function div(a,b) { return a / b; } div.oo = orderOfOperations.MUL;

function exp(a,b) { return Math.pow(a,b); } exp.oo = orderOfOperations.EXP;
function sqrt(a)  { return Math.sqrt(a);  } orderOfOperations.FN;

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
 for(var fn in trig_fns) { trig_fns[fn].oo = orderOfOperations.FN; }

function log(base,val) { return Math.log(val) / Math.log(base); } log.oo = orderOfOperations.FN;
function ln(a) { return Math.log(a); } ln.oo = orderOfOperations.FN;

function abs(a) { return Math.abs(a); } abs.oo = orderOfOperations.FN;

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

function genExpression(op,left,right) {
	console.log(((op) ? op.name : op) + ', ' 
	+ (left ? left.toString() : left) + ', ' 
	+ (right ? right.toString() : right));
	
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

function getExpression(expressions,operations) {
	console.log('Getting expression');
	var opEnd = operations.length - 1;
	var exprEnd = expressions.length - 1;
	if(opEnd < 0) {
		if(exprEnd < 0) return null;
		else return expressions.pop();//this is a valid constant or t
	}
	do {
		var op = operations.pop(), left = undefined, right = undefined;
		--opEnd;
		for(var i = 0, args = op.length; i < args; ++i) {
			if(exprEnd < 0) {
				errString = "Not enough arguments for function: " + operations[opEnd];
				return undefined;
			}
			var expr = expressions.pop();
			if(right) left  = expr;
			else      right = expr;
			--exprEnd;
		}
		expressions.push(genExpression(op,left,right));
		exprEnd++;
	} while(opEnd >= 0);
	return expressions.pop();
}

function printStack(stack,depth) {
	var str = '';
	for(var i = 0; i < depth + 1;i++) {
		str += '[';
		for(var thing in stack[i]) {
			var curr = stack[i][thing];
			str += (curr.hasOwnProperty('left') ? curr.toString() : curr.name) + ', ';
		}
		str += '], ';
	}
	console.log(str);
}

function parseEquation(eqString) {
	errString = 'Something went wrong :(';
	//remove whitespace
	eqString = eqString.replace(/\s+/g,'');
	if(!eqString.length) {
		errString = 'You must input an equation';
		return undefined;
	}
	var expressionList = [[]];
	var operationList = [[]];
	var depth = 0;
	var numExprReq = [0];
	var lastOp = [];
	while(eqString.length) {
		//first expression present
		//it matches each time because some results are dependent on others being processed
		var expr = eqString.match(finder_regex);
		if(!expr) {
			errString = 'Invalid equation, there was an invalid term';
			return undefined;
		}
		expr = expr[0];
		eqString = eqString.replace(finder_regex,'');
		console.log('=> ' + expr + ', ' + eqString);
		var currOp = undefined, num_present = false;
		if(expr[0] == '(' || expr[0] == '|') {
			//if we're processing an abs, to close:
			//one of the previous levels' last op must also be an abs
			//and the number of required expressions in the current level must be satisfied
			//otherwise, open a new one
			if(expr[0] == '|' && depth && numExprReq[depth] <= expressionList[depth].length
			&& lastOp.some(function(el) { return el == '|'; })) {
				var absExpr = getExpression(expressionList[depth],operationList[depth]);
				if(absExpr == undefined) return undefined;
				depth--;
				if(absExpr != null) expressionList[depth].push(genExpression(abs,absExpr,undefined));
			}
			else {
				lastOp[depth] = expr[0];
				++depth;
				lastOp[depth] = undefined;
				expressionList[depth] = [];
				operationList[depth] = [];
				numExprReq[depth] = 0;
			}
		}
		else if(expr[0] == ')') {
			if(!depth || !lastOp.some(function(el) { return el == '('; })) {
				errString = 'Closing ) found with no matching open (';
				return undefined;
			}
			var parenExpr = getExpression(expressionList[depth],operationList[depth]);
			if(parenExpr == undefined) return undefined;
			depth--;
			if(parenExpr != null) expressionList[depth].push(parenExpr);
		}
		else if(trig_regex.test(expr)) {
			operationList[depth].push(trig_fns[expr]);
			currOp = 'fn';
			numExprReq[depth] = (trig_fns[expr].length > numExprReq[depth]) ? 
				trig_fns[expr].length : numExprReq[depth] + 1;
			
		}
		else if(log_regex.test(expr)) {
			if(expr[1] == 'n') {
				operationList[depth].push(ln);
				numExprReq[depth] = (ln.length > numExprReq[depth]) ? 
					ln.length : numExprReq[depth] + 1;
			}
			else {
				operationList[depth].push(log);
				if(expr.length < 4)//there's no base specified
					expressionList[depth].push(new Constant(10));
				numExprReq[depth] = (log.length > numExprReq[depth]) ? 
					log.length : numExprReq[depth] + 1;
			}
			currOp = 'fn';
		}
		else if(/(sqrt)/.test(expr)) {
			operationList[depth].push(sqrt);
			currOp = 'fn';
			numExprReq[depth] = (sqrt.length > numExprReq[depth]) ? 
					sqrt.length : numExprReq[depth] + 1;
		}
		else if(operator_regex.test(expr)) {
			if((expr[0] == '+' || expr[0] == '-') 
				&& numExprReq[depth] > expressionList[depth].length) {
				expressionList[depth].push(new Constant(0));
			}
			if(expr[0] == '^' || expr[0] == 's') {
				var trig_op;
				if( lastOp[depth] == 'fn'
					&& (trig_op = operationList[depth][operationList[depth].length - 1])
					&& trig_fns.hasOwnProperty(trig_op.name) ) {
					//special case for trig exponents; we have to swap the operations
					//because the exponent would come second
					//unfortunately, the way this works for trig^e(n) we end up with 
					//(exp e (trig n)) instead of (exp (trig n) e)
					//so this is broken right now
					operationList[depth].push(trig_op);
					operationList[depth][operationList[depth].length - 2] = exp;
					currOp = 'fn';
					lastOp[depth] = 'op';//for the swap to work
				}
				else {
					operationList[depth].push(exp);
					currOp = 'op';
				}
				numExprReq[depth] = (exp.length > numExprReq[depth]) ? 
					exp.length : numExprReq[depth] + 1;
			}
			else if(expr[0] == '*') {
				operationList[depth].push(mul);
				currOp = 'op';
				numExprReq[depth] = (mul.length > numExprReq[depth]) ? 
					mul.length : numExprReq[depth] + 1;
			}
			else if(expr[0] == '/') {
				operationList[depth].push(div);
				currOp = 'op';
				numExprReq[depth] = (div.length > numExprReq[depth]) ? 
					div.length : numExprReq[depth] + 1;
			}
			else if(expr[0] == '+') {
				operationList[depth].push(add);
				currOp = 'op';
				numExprReq[depth] = (add.length > numExprReq[depth]) ? 
					add.length : numExprReq[depth] + 1;
			}
			else if(expr[0] == '-') {
				operationList[depth].push(sub);
				currOp = 'op';
				numExprReq[depth] = (sub.length > numExprReq[depth]) ? 
					sub.length : numExprReq[depth] + 1;
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
			currOp = 'num';
			var before = numExprReq[depth] < expressionList[depth].length;
			var after;
			expressionList[depth].push(val);
			//this needs to be generalized for ALL non-operations
			if(expressionList[depth].length > 1 
			&& (after = numExprReq[depth] < expressionList[depth].length)
			&& lastOp[depth] != 'op') {
				//there's an implicit multiply
				operationList[depth].push(mul);
				if(before == after) currOp = 'op';
				else                lastOp[depth] = 'op';
				numExprReq[depth] = (mul.length > numExprReq[depth]) ? 
					mul.length : numExprReq[depth] + 1;
				//if we break order of operations, we need to step back
				var numOps = operationList[depth].length;
				if(after && numOps > 1 && operationList[depth][numOps - 2].oo < operationList[depth][numOps - 1].oo) {
					expressionList[depth].pop();
					eqString = expr + eqString;
				}
			}
		}
		
		//console.log(lastOp[depth] + ', ' + currOp);
		var numOps = operationList[depth].length;
		if( numOps > 1 &&
			operationList[depth][numOps - 2].oo <= operationList[depth][numOps - 1].oo ) {
			//we must evaluate an expression since we broke order of operations
			var op = operationList[depth].pop();
			expressionList[depth] = 
				[ getExpression( expressionList[depth], operationList[depth] ) ];
			operationList[depth] = [ op ];
			numExprReq[depth] = op.length;
		}
		lastOp[depth] = currOp;
		printStack(expressionList,depth);
		printStack(operationList,depth);
	}
	if(depth > 0) {
		errString = 'Open ' + lastOp[depth - 1] + ' found with no closure';
		return undefined;
	}
	else if(numExprReq[depth] > expressionList[depth].length) {
		errString = 'Insufficient number of arguments';
		return undefined;
	}
	var final_expr = getExpression(expressionList[depth],operationList[depth]);
	return final_expr;
}
