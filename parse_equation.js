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
			- These only can occur at the start of an equation, 
				- otherwise they're rightly interpreted as operations
			- The implementation is just if there is an operation with no expression present
				- Add a 0
				- Theoretically, an implicit * or / would be a 1, but that's undefined anyway
		- Implicit *
			- This can happen on the left or right of any expression
				- If a numeric is immediately followed by a paren, a function, or t, 
					- there is an implicit *
				- If a paren, a [closed] function, or t is immediately followed by a numeric
					- there is an implicit *
		- When an implicit operation is detected, 
			- the applicable operation/numeric is added automatically
-------------------------------------------------------------------------------------------
*/

var errString = '';//used for error handling

var number = '\d+';
var constant = 'e|pi|phi';
var number_regex_str = '(' + number + '|' + constant + ')';
var log_regex_str = '(log(_' + number_regex_str + ')?|ln)';//if no base is included, it's assumed to be 10
var trig_regex_str = '((a|arc)?((cos)|(sin)|(tan)|(sec)|(csc)|(cot))h?)';
var add_regex = '(\+|-)';
var mul_regex = '(\*|\/)';
var operator_regex = '(\^|' + mul_regex + '|' + add_regex + ')';
var finder_regex = new RegExp(
'(' + number_regex_str + '|\(|)|' + trig_regex_str + '|' + log_regex_str + '|' operator_regex + ')'
);
var number_regex = 	 new RegExp(number_regex_str);
var trig_regex = 	 new RegExp(trig_regex_str);
var log_regex = 	 new RegExp(log_regex_str);

var phi = (1 + Math.sqrt(5)) / 2;// 1.618033988749895
var pi = Math.PI;
var e = Math.E;

function add(a,b) { return a + b; }
function sub(a,b) { return a - b; }
function mul(a,b) { return a * b; }
function div(a,b) { return a / b; }

function exp(a,b) { return Math.pow(a,b); } 
function sqrt(a)  { return Math.sqrt(a);  }

function sin(a)  { return Math.sin(a);  }     function asin(a)  { return Math.asin(a);  }
function sinh(a) { return Math.sinh(a); }     function asinh(a) { return Math.asinh(a); }
function cos(a)  { return Math.cos(a);  }     function acos(a)  { return Math.acos(a);  }
function cosh(a) { return Math.cosh(a); }     function acosh(a) { return Math.acosh(a); }
function tan(a)  { return Math.tan(a);  }     function atan(a)  { return Math.atan2(a); }
function tanh(a) { return Math.tanh(a); }     function atanh(a) { return Math.atanh(a); }
function csc(a)  { return 1 / Math.sin(a);  } function acsc(a)  { return Math.asin(1/a);  }
function csch(a) { return 1 / Math.sinh(a); } function acsch(a) { return Math.asinh(1/a); }
function sec(a)  { return 1 / Math.cos(a);  } function asec(a)  { return Math.acos(1/a);  }
function sech(a) { return 1 / Math.cosh(a); } function asech(a) { return Math.acosh(1/a); }
function cot(a)  { return 1 / Math.tan(a);  } function cot(a)   { return Math.atan2(1/a); }
function coth(a) { return 1 / Math.tanh(a); } function coth(a)  { return Math.atanh(1/a); }
var trig_fns = { 
	sin:sin,asin:asin,arcsin:asin,sinh:sinh,asinh:asinh,arcsinh:asinh,
	cos:cos,acos:acos,arccos:acos,cosh:cosh,acosh:acosh,arccosh:acosh,
	tan:tan,atan:atan,arctan:atan,tanh:tanh,atanh:atanh,arctanh:atanh,
	csc:csc,acsc:acsc,arccsc:acsc,csch:csch,acsch:acsch,arccsch:acsch,
	sec:sec,asec:asec,arcsec:asec,sech:sech,asech:asech,arcsech:asech,
	cot:cot,acot:acot,arccot:acot,coth:coth,acoth:acoth,arccoth:acoth
 };

function log(base,val) { return Math.log(val) / Math.log(base); }
function ln(a) { return Math.log(a); }

function abs(a) { return Math.abs(a); }

var orderOfOperations = [ 'fn','exp','mul','add' ];

var Expression = function(op,a,b) {
	this.operation = op;
	this.left = a;
	this.right = b;
};

Expression.prototype.evaluate = function(t) {
	return this.operation(this.left.evaluate(t)), this.right.evaluate(t));
}

var T = function() { Expression.call(this); }
T.prototype = Object.create(Expression.prototype);
T.prototype.evaluate = function(t) { return t; }

var Constant = function(val) { Expression.call(this); this.value = val; }
Constant.prototype = Object.create(Expression.prototype);
Constant.prototype.evaluate = function(t) { return this.value; }

function genExpression(op,left,right) {
	if(left.value && right.value)
		return new Constant(op(left,right));
	return new Expression(op,left,right);
}

function getExpression(expressions,operations) {
	var opEnd = operations.length - 1;
	var exprEnd = expressions.length - 1;
	if(opEnd < 0) {
		if(exprEnd < 0) return null;
		else return new Constant(exprEnd[0]);
	}
	do {
		var expression = new Expression();
		expression.op = operations.pop();
		--opEnd;
		for(var i = 0, args = expression.op.length; i < args; ++i) {
			if(exprEnd < 0) {
				errString = "Not enough arguments for function: " + operations[opEnd];
				return undefined;
			}
			if(expression.left) expression.right = expressions[exprEnd];
			else 				expression.left  = expressions[exprEnd];
			--exprEnd;
		}
		expressions.push(expression);
	} while(opEnd > 0);
	return expressions[0];
}

function parseEquation(eqString) {
	eqString = eqString.replace(/\s+/g,'');
	if(!eqString.length) {
		errString = 'You must input an equation';
		return undefined;
	}
	eqString = eqString.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	var expressionList = [[]];
	var operationList = [[]];
	var depth = 0;
	var lastOp = [];
	while(eqString.length) {
		var expr = eqString.match(finder_regex)[0];
		eqString = eqString.replace(finder_regex,'');
		var currOp;
		if(!expr.length) {
			//the string has been depleted? Somehow?
			errString = 'Ran out of characters to check';
			return undefined;
		}
		else if(expr.test(number_regex)) {
			expressionList[depth].push(new Constant(Number.parseFloat(expr)));
		}
		else if(expr[0] == '(' || expr[0] == '|') {
			lastOp[depth] = expr[0];
			++depth;
			expressionList[depth] = [];
			operationList[depth] = [];
		}
		else if(expr[0] == ')') {
			if(!depth) {
				errString = 'Closing ) found with no matching open (';
				return undefined;
			}
			var parenExpr = getExpression(expressionList[depth],operationList[depth]);
			depth--;
			if(parenExpr != null) expressionList[depth].push(parenExpr);
		}
		else if(expr.test(trig_regex)) {
			operationList[depth].push(trig_fns[expr]);
			currOp = 'fn';
		}
		else if(expr.test(log_regex)) {
			if(expr[1] == 'n') operationList[depth].push(ln);
			else {
				operationList[depth].push(log);
				var base = expr.match(number_regex)[0];
				if(base) expressionList[depth].push(new Constant(Number.parseFloat(base)));
				else 	 expressionList[depth].push(new Constant(10));
			}
			currOp = 'fn';
		}
		else if(expr.test(operator_regex)) {
			if(!expressions[depth].length) {
				expressions[depth].push(new Constant(0));
			}
			if(expr[0] == '^') {
				var op;
				if( lastOp[depth] && op = operations[depth][operations[depth].length - 1]
					&& trig_fns.hasOwnProperty(op.name) ) {
					//special case for trig exponents; we have to swap the operations
					//because the exponent would come second
					operationList[depth].push(op);
					operationList[depth][operationList[depth].length - 2] = exp;
				}
				else operationList[depth].push(exp);
				currOp = 'exp';
			}
			else if(expr[0] == '*') {
				operationList[depth].push(mul);
				currOp = 'mul';
			}
			else if(expr[0] == '\') {
				operationList[depth].push(div);
				currOp = 'mul';
			}
			else if(expr[0] == '+') {
				operationList[depth].push(add);
				currOp = 'add';
			}
			else if(expr[0] == '-') {
				operationList[depth].push(sub);
				currOp = 'add';
			}
			
			if( currOp && lastOp[depth] 
			&& orderOfOperations.indexOf(currOp) < orderOfOperations.indexOf(lastOp[depth]) ) {
				//we must evaluate an expression since we broke order of operations
				var op = operationList.pop();
				expressionList[depth] = 
					[ getExpression( expressionList[depth], operationList[depth] ) ];
				operationList[depth] = [ op ];
			}
			lastOp[depth] = currOp;
		}
	}
	if(depth > 0) {
		errString = 'Open ( found with no matching closing )';
		return undefined;
	}
}