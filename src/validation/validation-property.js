import * as AllCollections from '../validation/validation-rules-collection';
import {PathObserver} from '../validation/path-observer';
import {Debouncer} from '../validation/debouncer';

export class ValidationProperty {
  constructor(observerLocator, propertyName, validationGroup, propertyResult, config) {
    this.propertyResult = propertyResult;
    this.propertyName = propertyName;
    this.validationGroup = validationGroup;
    this.collectionOfValidationRules = new AllCollections.ValidationRulesCollection();
    this.config = config;
    this.latestValue = undefined;

    this.observer = new PathObserver(observerLocator, validationGroup.subject, propertyName)
      .getObserver();

    this.debouncer = new Debouncer(config.getDebounceTimeout());

    this.observer.subscribe(() => {
      this.debouncer.debounce( () => {
        var newValue =   this.observer.getValue();
        if(newValue !== this.latestValue) {
          this.validate(newValue, true);
        }
      });
    });

    this.dependencyObservers = [];
    var dependencies = this.config.getDependencies();
    for(let i = 0; i < dependencies.length; i++){
      let dependencyObserver = new PathObserver(observerLocator, validationGroup.subject, dependencies[i])
        .getObserver();
      dependencyObserver.subscribe(() => {
        this.debouncer.debounce( () => {
          this.validateCurrentValue(true);
        });
      });
      this.dependencyObservers.push(dependencyObserver);
    }
  }

  addValidationRule(validationRule) {
    if (validationRule.validate === undefined) //Can ES6 check on base class??
      throw new exception("That's not a valid validationRule");
    this.collectionOfValidationRules.addValidationRule(validationRule);
    this.validateCurrentValue(false);
  }

  validateCurrentValue(forceDirty, forceExecution) {
    return this.validate(this.observer.getValue(), forceDirty, forceExecution);
  }

  clear(){
    this.latestValue = this.observer.getValue();
    this.propertyResult.clear();
  }

  /**
   * returns a promise that fulfils and resolves to true/false
   */
  validate(newValue, shouldBeDirty, forceExecution) {
    if( (!this.propertyResult.isDirty && shouldBeDirty) || this.latestValue !== newValue || forceExecution) {
      this.latestValue = newValue;
      return this.config.locale().then((locale) => {
          return this.collectionOfValidationRules.validate(newValue, locale)
            .then((validationResponse) => {
              if (this.latestValue === validationResponse.latestValue)
                this.propertyResult.setValidity(validationResponse, shouldBeDirty);
              return validationResponse.isValid;
            })
            .catch((err) => {
              console.log("Unexpected behavior: a validation-rules-collection should always fulfil", err);
              debugger;
              throw Error("Unexpected behavior: a validation-rules-collection should always fulfil");
            });
        },
        () => {
          throw Error("An exception occurred while trying to load the locale");
        });
    }
  }
}
