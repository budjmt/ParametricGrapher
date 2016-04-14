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

var phi = (1 + Math.sqrt(5)) / 2;// 1.618033988749895
var pi = Math.PI;
var e = Math.E;

var number = '\d+(\.\d+)?';
var constant_list = ['e','pi','phi'];
var constant_vals = [ e, pi, phi ];
var constant = constant_list.join('|');
constant_list.forEach(function(element,index) { constant_list[index] = [ new RegExp(element), constant_vals[index] ]; });
var number_regex_str = '(' + number + '|' + constant + ')';

var log_regex_str = '(log(_' + number_regex_str + ')?|ln)';//if no base is included, it's assumed to be 10
var trig_regex_str = '((a|arc)?((cos)|(sin)|(tan)|(sec)|(csc)|(cot))h?)';

var add_regex = '(\+|-)';
var mul_regex = '(\*|\/)';
var operator_regex = '(\^|(sqrt)' + mul_regex + '|' + add_regex + ')';

var finder_regex = new RegExp(
'(^' + number_regex_str + '|^\(|^\)|^' + trig_regex_str + '|^' + log_regex_str + '|^' operator_regex +  '|^t)'
);

var number_regex = new RegExp(number_regex_str);
var trig_regex   = new RegExp(trig_regex_str);
var log_regex    = new RegExp(log_regex_str);

function add(a,b) { return a + b; }
function sub(a,b) { return a - b; }
function mul(a,b) { return a * b; }
function div(a,b) { return a / b; }

function exp(a,b) { return Math.pow(a,b); } 
function sqrt(a)  { return Math.sqrt(a);  }

function sin(a)  { return Math.sin(a);  }     function asin(a)  { return Math.asin(a);    }
function sinh(a) { return Math.sinh(a); }     function asinh(a) { return Math.asinh(a);   }
function cos(a)  { return Math.cos(a);  }     function acos(a)  { return Math.acos(a);    }
function cosh(a) { return Math.cosh(a); }     function acosh(a) { return Math.acosh(a);   }
function tan(a)  { return Math.tan(a);  }     function atan(a)  { return Math.atan2(a,1); }
function tanh(a) { return Math.tanh(a); }     function atanh(a) { return Math.atanh(a);   }
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
	var l = (this.left)  ? this.left.evaluate(t)  : this.left;//left should never be undefined, but w/e
	var r = (this.right) ? this.right.evaluate(t) : this.right;
	return this.operation(l, r);
}

var T = function() { Expression.call(this); }
T.prototype = Object.create(Expression.prototype);
T.prototype.evaluate = function(t) { return t; }

var Constant = function(val) { Expression.call(this); this.value = val; }
Constant.prototype = Object.create(Expression.prototype);
Constant.prototype.evaluate = function() { return this.value; }

function genExpression(op,left,right) {
	if(((left && left.value) || !left) && ((right && right.value) || !right))
		return new Constant(op(left,right));
	return new Expression(op,left,right);
}

function getExpression(expressions,operations) {
	var opEnd = operations.length - 1;
	var exprEnd = expressions.length - 1;
	if(opEnd < 0) {
		if(exprEnd < 0) return null;
		else return expressions[exprEnd];//this is a valid constant or t
	}
	do {
		var op = operations.pop(), left, right;
		--opEnd;
		for(var i = 0, args = op.length; i < args; ++i) {
			if(exprEnd < 0) {
				errString = "Not enough arguments for function: " + operations[opEnd];
				return undefined;
			}
			if(right) left  = expressions[exprEnd];
			else                 right = expressions[exprEnd];
			--exprEnd;
		}
		expressions.push(genExpression(op,left,right));
	} while(opEnd > 0);
	return expressions[0];
}

function parseEquation(eqString) {
	errString = 'Something went wrong :(';
	//remove whitespace
	eqString = eqString.replace(/\s+/g,'');
	if(!eqString.length) {
		errString = 'You must input an equation';
		return undefined;
	}
	//format for regex
	eqString = eqString.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	var expressionList = [[]];
	var operationList = [[]];
	var depth = 0;
	var numExprReq = [0];
	var lastOp = [];
	while(eqString.length) {
		//first expression present
		//it matches each time because some results are dependent on others being processed
		var expr = eqString.match(finder_regex)[0];
		eqString = eqString.replace(finder_regex,'');
		var currOp, num_present;
		if(!expr.length) {
			//the string has been depleted? Somehow?
			errString = 'Ran out of characters to check';
			return undefined;
		}
		else if(num_present = expr.test(number_regex) || expr.test(/t/)) {
			var val;
			if (expr.test(/\d+(\.\d+)?/)) { val = new Constant(Number.parseFloat(expr)); }
			else if(num_present) {
				constant_list.some(function(element,index) {
					var found = expr.test(element[0]);
					return found && val = new Constant(element[1]);
				});
			}
			else { val = new T(); }
			expressionList[depth].push(val);
			//this needs to be generalized for ALL non-operations
			if(expressionList[depth].length > 1 && numExprReq[depth] < expressionList[depth].length
			&& !(lastOp[depth] == 'exp' || lastOp[depth] == 'mul' || lastOp[depth] == 'add')) {
				//there's an implicit multiply
				operations.push(mul);
			}
		}
		else if(expr[0] == '(' || expr[0] == '|') {
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
			if(!depth || lastOp.some(function(el) { return el == '('; })) {
				errString = 'Closing ) found with no matching open (';
				return undefined;
			}
			var parenExpr = getExpression(expressionList[depth],operationList[depth]);
			if(parenExpr == undefined) return undefined;
			depth--;
			if(parenExpr != null) expressionList[depth].push(parenExpr);
		}
		else if(expr.test(trig_regex)) {
			operationList[depth].push(trig_fns[expr]);
			currOp = 'fn';
			numExprReq[depth] += trig_fns[expr].length;
		}
		else if(expr.test(log_regex)) {
			if(expr[1] == 'n') {
				operationList[depth].push(ln);
				numExprReq[depth] += ln.length;
			}
			else {
				operationList[depth].push(log);
				var base = expr.match(number_regex)[0];
				if(base) expressionList[depth].push(new Constant(Number.parseFloat(base)));
				else 	 expressionList[depth].push(new Constant(10));
				numExprReq[depth] += log.length;
			}
			currOp = 'fn';
		}
		else if(expr.test(operator_regex)) {
			if((expr[0] == '+' || expr[0] == '-') && numExprReq[depth] > expressions[depth].length) {
				expressions[depth].push(new Constant(0));
			}
			if(expr[0] == '^' || expr[0] == 's') {
				var op = exp, trig_op;
				if(expr[0] == 's') { op = sqrt; operationList[depth].push(sqrt); }
				else if( lastOp[depth] && trig_op = operations[depth][operations[depth].length - 1]
					&& trig_fns.hasOwnProperty(trig_op.name) ) {
					//special case for trig exponents; we have to swap the operations
					//because the exponent would come second
					operationList[depth].push(trig_op);
					operationList[depth][operationList[depth].length - 2] = exp;
				}
				else operationList[depth].push(exp);
				currOp = 'exp';
				numExprReq[depth] += op.length;
			}
			else if(expr[0] == '*') {
				operationList[depth].push(mul);
				currOp = 'mul';
				numExprReq[depth] += mul.length;
			}
			else if(expr[0] == '/') {
				operationList[depth].push(div);
				currOp = 'mul';
				numExprReq[depth] += div.length;
			}
			else if(expr[0] == '+') {
				operationList[depth].push(add);
				currOp = 'add';
				numExprReq[depth] += add.length;
			}
			else if(expr[0] == '-') {
				operationList[depth].push(sub);
				currOp = 'add';
				numExprReq[depth] += sub.length;
			}
			
			if( currOp && lastOp[depth] 
			&& orderOfOperations.indexOf(currOp) < orderOfOperations.indexOf(lastOp[depth]) ) {
				//we must evaluate an expression since we broke order of operations
				var op = operationList.pop();
				expressionList[depth] = 
					[ getExpression( expressionList[depth], operationList[depth] ) ];
				operationList[depth] = [ op ];
				numExprReq[depth] = op.length;
			}
			lastOp[depth] = currOp;
		}
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
