


July
Time	Speaker	Title	Location
14:00 - 14:45	Giangiacomo Mercatalicall_made
Haute Ecole de Gestion de Genève
Talks in Financial and Insurance Mathematics
Constraining Generative Models: Conditioning, Structure, and Physics in Diffusion and Flowsread_more

Dear all, we have a special presentation in the Fin & Ins Math Seminar this Thursday:

Speaker: Giangiacomo Mercatali, Haute Ecole de Gestion de Genève
Title: Constraining Generative Models: Conditioning, Structure, and Physics in Diffusion and Flows
Time: 2:00 - 2:45 pm on Thursday, July 2 
Location: HG F 26.5

Abstract: 
Diffusion and flow-matching models have become the default tools for generative modeling, but in scientific and structured domains their value depends on one ability: to generate not just plausible samples, but samples that satisfy prescribed constraints and guidance signals — known physics, structure, and target properties. Such requirements come in several distinct types, and a generative model has to be designed in a specific way to accommodate each. This talk frames a line of work around that question — how do we build diffusion and flow models that respect different kinds of constraints? — and presents one design per type.

The first type is conditioning on target properties: a score-based diffusion with
co-evolving processes that exchange information through loop guidance, steering generation toward desired attributes. The second is structural: a continuous-time flow constrained by a causal dependency graph, learned jointly with the dynamics of interacting time series. The third is partial physics: when the governing equations are known only in part, a grey-box flow-matching model embeds the available physics while a structured latent absorbs the unknown parameters and stochasticity. The fourth is hard physical constraints — conservation laws, boundary conditions — enforced at sampling time by projecting generation onto the constraint manifold.

Best, Patrick


focus here on one of the papers he showed: Diffusion Twigs with Loop Guidance for Conditional Graph Generation

Here is a beginner-friendly recap of the paper **"Diffusion Twigs with Loop Guidance for Conditional Graph Generation"** (published at NeurIPS 2024).

### The Big Picture

Imagine you are trying to design a custom car. You have the **main structure** (the chassis and engine) and you have **specific conditions** you want it to meet (it must be fast, safe, and fuel-efficient).

In the AI world, researchers often try to generate complex structures called "graphs" (think of a web of connected dots, like a chemical molecule). Generating a molecule is hard, but generating one that perfectly matches *specific conditions* (like being a good medicine without being toxic) is incredibly difficult. This paper introduces a new AI method called **Twigs** to solve this exact problem.

### How "Twigs" Works

The researchers named their AI model "Twigs" because it grows ideas similarly to how a plant grows:

1. **The Trunk (The Main Builder):** This part of the AI focuses entirely on building the primary structure. If the AI is designing a molecule, the "Trunk" is in charge of figuring out the core shape and how the atoms connect to each other.
2. **The Stems (The Specialists):** Branching off from the Trunk are "Stems." These are smaller, specialized processes that focus solely on the *conditions* or properties the structure needs to have (e.g., checking if the molecule is non-toxic, or if it dissolves in water).

### The Secret Sauce: "Loop Guidance"

If the Trunk built the structure blindly while the Stems only worried about the rules, the final result wouldn't work. They need to communicate.

To fix this, the authors invented **Loop Guidance**. This is a continuous feedback loop between the Trunk and the Stems. As the Trunk is slowly putting the structure together, it constantly "talks" to the Stems. The Stems analyze what the Trunk is doing and send back guidance, nudging the Trunk in the right direction to ensure the final structure perfectly matches the required conditions.

### Why Does This Matter?

By allowing the "structure builder" and the "rule checkers" to co-evolve and constantly communicate, this AI uncovers complex patterns that older methods completely miss.

In their experiments, the researchers showed that the **Twigs** method is incredibly powerful 
for tasks like **molecular optimization** and **drug discovery**. 
It allows scientists to start with the medical properties they want a drug to have, 
and rely on the AI to successfully "draw" a brand new molecule that perfectly fits 
those exact needs.

more in depth:

## The problem it's solving

Suppose you want to design a new molecule that has some specific property — say a particular drug-likeness score, or a strong binding affinity to a target protein. There are astronomically many possible molecules, so you can't just search through them all. The goal is a model that generates new molecules on demand, where you specify the property you want and it produces molecules that actually have it.

Molecules can be represented as graphs: atoms are nodes, bonds are edges. So this is a "conditional graph generation" problem, meaning "generate a graph, given a condition (the desired property)."

## The tool they build on: diffusion models

A diffusion model works in two stages. First, take a real example and gradually add random noise to it, step by step, until nothing is left but static. That's the forward process, and it's easy because adding noise is trivial. Then train a neural network to undo one step of noise at a time. That's the reverse process. Once the network can reverse noise, you generate something new by starting from pure random noise and running the reverse process until a realistic molecule appears.

To make the output have a *desired* property rather than just any valid molecule, you need "guidance" — a way to steer the reverse process. Two standard methods exist. One trains a separate predictor that estimates the property from a noisy sample and nudges generation in the direction that increases it. The other trains the diffusion model itself to work both with and without the condition, then blends the two. The paper's complaint is that both methods treat the property as a fixed tag you attach to the process, which is a fairly blunt way to handle it.

## What Twigs does differently

The name comes from a tree analogy. There is one main diffusion process, the **trunk**, which handles the graph structure (the atoms and bonds). Then, for each property you care about, there is a separate smaller process, a **stem**, which handles that one property. All of these run at the same time and influence each other.

The mechanism connecting them is called **loop guidance**. In each step of generation, the structure is denoised first. The updated structure is then used to denoise the properties. The updated properties are then fed back to further denoise the structure. This back-and-forth repeats at every step, which is where "loop" comes from. The intuition is that structure and properties get to negotiate with each other continuously, instead of the property just sitting on the side as a fixed label.

They call the design "asymmetric" because the trunk (structure) is treated as primary and the stems (properties) as secondary. Earlier methods that used multiple diffusion flows gave every flow the same role; Twigs deliberately does not.

## What they tested and found

They ran three kinds of experiments. On QM9, a standard dataset of small molecules with known quantum properties, they generated molecules targeting specific properties and measured how close the result came to the target. On ZINC250K, they generated molecules meant to bind well to five target proteins. And they generated generic network graphs with target structural properties like density and clustering.

Across almost all of these, Twigs produced molecules whose properties landed closer to the requested target than the competing methods did, and also scored well on separate measures of chemical validity and stability. It was not universally best on every single case (for one protein target, an older method edged it out), but it won most comparisons.

## The catch

Two limitations, both acknowledged in the paper. Each property you add is another diffusion process to train, so more properties mean more computation and longer training time — though they show the added time is modest. And the method assumes the properties are independent of each other once the structure is fixed. That assumption keeps the math tractable, but it will not hold perfectly for properties that are genuinely correlated, which could limit accuracy in those cases.

If any specific piece is unclear — the diffusion mechanics, the score-function math in the tables, or how the experiments are scored — tell me which and I'll go deeper on just that part.